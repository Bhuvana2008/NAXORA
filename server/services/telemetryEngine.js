const db = require('../database');
const { evaluateAnomaly, COST_RATES } = require('./anomalyEngine');
const { calculateTotalPotentialSavings } = require('./predictionEngine');

// SSE Subscriber Listeners
const sseClients = new Set();

function registerSseClient(res) {
    sseClients.add(res);
}

function unregisterSseClient(res) {
    sseClients.delete(res);
}

function broadcastTelemetryEvent(eventData) {
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const client of sseClients) {
        try {
            client.write(payload);
        } catch (e) {
            sseClients.delete(client);
        }
    }
}

/**
 * Standard Telemetry Ingestion Pipeline:
 * Validates, records reading, evaluates baseline deviation, updates hotspots,
 * synchronizes deduplicated alerts & insights, records audit log.
 */
function processTelemetryInput(raw) {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Invalid telemetry payload: Request body must be a JSON object.');
    }

    // 1. Parse and Validate Location
    const rawLoc = (raw.location || raw.building_name || raw.building || '').toString().trim();
    if (!rawLoc) {
        throw new Error('Validation error: "location" is required (e.g. "Block A - Room 204", "Block B - Room 105", "Lab 2").');
    }

    let building = rawLoc;
    let room = '';

    if (rawLoc.includes(' - ')) {
        const parts = rawLoc.split(' - ');
        building = parts[0].trim();
        room = parts.slice(1).join(' - ').trim();
    } else if (rawLoc.includes(' • ')) {
        const parts = rawLoc.split(' • ');
        building = parts[0].trim();
        room = parts.slice(1).join(' • ').trim();
    } else if (raw.building && raw.room) {
        building = raw.building.toString().trim();
        room = raw.room.toString().trim();
    } else {
        building = rawLoc;
        room = raw.room ? raw.room.toString().trim() : '';
    }

    const locationFormatted = room ? `${building} - ${room}` : building;
    const facilityId = (raw.facility || raw.facility_id || 'campus').toString().trim().toLowerCase();

    // 2. Parse and Validate Resource Type
    const rawType = (raw.resourceType || raw.resource_type || '').toString().trim();
    if (!rawType) {
        throw new Error('Validation error: "resourceType" is required (e.g. "electricity", "water", "temperature", "occupancy").');
    }

    let resourceType = 'Electricity';
    const lowerType = rawType.toLowerCase();
    if (lowerType.includes('water')) resourceType = 'Water';
    else if (lowerType.includes('temp')) resourceType = 'Temperature';
    else if (lowerType.includes('occup')) resourceType = 'Occupancy';
    else if (lowerType.includes('gas')) resourceType = 'Gas';
    else if (lowerType.includes('hvac')) resourceType = 'HVAC';
    else resourceType = 'Electricity';

    // 3. Parse and Validate Numeric Value
    const rawVal = raw.value !== undefined ? raw.value : (raw.consumption !== undefined ? raw.consumption : raw.consumption_value);
    if (rawVal === undefined || rawVal === null || isNaN(Number(rawVal))) {
        throw new Error(`Validation error: "value" must be a valid numeric value.`);
    }
    const currentValue = parseFloat(Number(rawVal).toFixed(2));
    if (currentValue < 0) {
        throw new Error('Validation error: "value" cannot be negative.');
    }

    // 4. Unit & Occupancy
    const defaultUnit = resourceType === 'Water' ? 'L' : (resourceType === 'Temperature' ? '°C' : (resourceType === 'Occupancy' ? 'people' : 'kWh'));
    const unit = (raw.unit || defaultUnit).toString().trim();
    if (!unit) {
        throw new Error('Validation error: "unit" is required (e.g. "kWh", "L").');
    }

    const occupancy = parseInt(raw.occupancy !== undefined ? raw.occupancy : raw.occupancy_count, 10) || 0;
    const source = (raw.source || (raw.deviceId ? 'ESP32' : 'MANUAL_INPUT')).toString().toUpperCase();
    const deviceId = (raw.deviceId || raw.device_id || (source === 'ESP32' ? 'ESP32-01' : 'MANUAL-INPUT-01')).toString().trim();
    const timestamp = raw.timestamp || new Date().toISOString();

    // 5. Determine Dynamic Baseline & Historical Sample Count per Location
    let baseline = null;
    let isLearning = false;

    // Query historical sample count and baseline for this location
    let historyCount = 0;
    try {
        const histRow = db.prepare(`
            SELECT COUNT(*) as count, AVG(baseline_value) as avg_base, AVG(value) as avg_val
            FROM resource_readings
            WHERE (building_id LIKE ? OR room_id LIKE ?) AND resource_type = ?
        `).get(`%${building}%`, `%${room || building}%`, resourceType);

        if (histRow) {
            historyCount = histRow.count || 0;
            if (histRow.avg_base && histRow.avg_base > 0) {
                baseline = Math.round(histRow.avg_base);
            }
        }
    } catch (e) {}

    // Check exact room & building in hotspots
    if (!baseline && room) {
        const exactHotspot = db.prepare("SELECT baseline_value FROM hotspots WHERE building LIKE ? AND room LIKE ?").get(`%${building}%`, `%${room}%`);
        if (exactHotspot && exactHotspot.baseline_value > 0) {
            baseline = exactHotspot.baseline_value;
        }
    }

    // If not found, check building in hotspots
    if (!baseline) {
        const bldHotspot = db.prepare("SELECT baseline_value FROM hotspots WHERE (building LIKE ? OR id LIKE ?) AND resource_type = ?").get(`%${building}%`, `%${building.toLowerCase().replace(/[^a-z0-9]/g, '-')}%`, resourceType);
        if (bldHotspot && bldHotspot.baseline_value > 0) {
            baseline = bldHotspot.baseline_value;
        }
    }

    // Standard Campus Zone Calibration Heuristics
    if (!baseline) {
        const bUpper = building.toUpperCase();
        if (bUpper.includes('BLOCK A')) baseline = resourceType === 'Water' ? 350 : 620;
        else if (bUpper.includes('BLOCK B')) baseline = resourceType === 'Water' ? 200 : 400;
        else if (bUpper.includes('LAB 1') || bUpper.includes('LAB 2') || bUpper.includes('LAB')) baseline = resourceType === 'Water' ? 120 : 280;
        else if (bUpper.includes('CANTEEN')) baseline = resourceType === 'Water' ? 45 : 400;
        else if (bUpper.includes('ADMIN')) baseline = resourceType === 'Water' ? 150 : 300;
        else if (bUpper.includes('HOSTEL')) baseline = resourceType === 'Water' ? 850 : 500;
        else if (bUpper.includes('LIBRARY')) baseline = resourceType === 'Water' ? 80 : 190;
        else {
            // Unrecognized/new location with no historical baseline -> enter baseline learning mode!
            baseline = currentValue;
            isLearning = true;
        }
    }

    // 6. Run Explainable AI Anomaly Detection
    const diagnostic = evaluateAnomaly(currentValue, baseline, resourceType, occupancy, isLearning, historyCount, locationFormatted, unit);

    // 7. Store in resource_readings
    const readResult = db.prepare(`
        INSERT INTO resource_readings (facility_id, building_id, room_id, resource_type, value, unit, baseline_value, occupancy, source, device_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(facilityId, building, room || building, resourceType, currentValue, unit, baseline, occupancy, source, deviceId, timestamp);

    const readingId = readResult.lastInsertRowid;

    // 8. Update Hotspots Table
    let hotspotId = building.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'block-a';
    if (hotspotId.includes('canteen')) hotspotId = 'canteen';
    else if (hotspotId.includes('lab-2') || hotspotId.includes('lab2')) hotspotId = 'lab2';
    else if (hotspotId.includes('admin')) hotspotId = 'admin';
    else if (hotspotId.includes('block-a')) hotspotId = 'block-a';
    else if (hotspotId.includes('block-b')) hotspotId = 'block-b';
    else if (hotspotId.includes('hostel')) hotspotId = 'hostel';
    else if (hotspotId.includes('library')) hotspotId = 'library';
    
    db.prepare(`
        INSERT INTO hotspots (id, facility_id, building, room, resource_type, current_value, baseline_value, deviation_percent, severity, confidence, status, recommended_action, reason, detected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            building = excluded.building,
            room = excluded.room,
            resource_type = excluded.resource_type,
            current_value = excluded.current_value,
            baseline_value = excluded.baseline_value,
            deviation_percent = excluded.deviation_percent,
            severity = excluded.severity,
            confidence = excluded.confidence,
            status = excluded.status,
            recommended_action = excluded.recommended_action,
            reason = excluded.reason,
            detected_at = CURRENT_TIMESTAMP
    `).run(hotspotId, facilityId, building, room || building, resourceType, currentValue, baseline, diagnostic.deviationPercent, diagnostic.severity, diagnostic.confidence, diagnostic.status, diagnostic.action, diagnostic.why);

    // 9. Manage Alert Lifecycle (Deduplicated on Location + Resource Type)
    let alertEvent = null;
    const isAnomaly = diagnostic.severity === 'CRITICAL' || diagnostic.severity === 'HIGH' || diagnostic.severity === 'MEDIUM';

    const existingAlert = db.prepare("SELECT * FROM alerts WHERE (hotspot_id = ? OR location = ?) AND resource_type = ? AND status = 'ACTIVE'")
        .get(hotspotId, locationFormatted, resourceType);

    if (isAnomaly) {
        const title = `${diagnostic.severity} ${resourceType.toUpperCase()} ANOMALY`;
        const msg = diagnostic.explanation;

        if (existingAlert) {
            // Update existing active alert to keep values current without duplicate spam
            db.prepare(`
                UPDATE alerts SET
                    current_value = ?,
                    baseline_value = ?,
                    deviation_percent = ?,
                    severity = ?,
                    message = ?,
                    title = ?,
                    location = ?
                WHERE id = ?
            `).run(currentValue, baseline, diagnostic.deviationPercent, diagnostic.severity, msg, title, locationFormatted, existingAlert.id);

            alertEvent = {
                id: existingAlert.id,
                isNew: false,
                location: locationFormatted,
                resourceType,
                severity: diagnostic.severity,
                currentValue,
                baseline,
                deviation: diagnostic.deviationPercent,
                message: msg,
                status: 'ACTIVE',
                createdAt: existingAlert.created_at
            };
        } else {
            // Insert new deduplicated alert
            const alertRes = db.prepare(`
                INSERT INTO alerts (hotspot_id, severity, title, message, location, resource_type, current_value, baseline_value, deviation_percent, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `).run(hotspotId, diagnostic.severity, title, msg, locationFormatted, resourceType, currentValue, baseline, diagnostic.deviationPercent);

            const newAlertId = alertRes.lastInsertRowid;
            const alertRow = db.prepare('SELECT created_at FROM alerts WHERE id = ?').get(newAlertId);

            alertEvent = {
                id: newAlertId,
                isNew: true,
                location: locationFormatted,
                resourceType,
                severity: diagnostic.severity,
                currentValue,
                baseline,
                deviation: diagnostic.deviationPercent,
                message: msg,
                status: 'ACTIVE',
                createdAt: alertRow ? alertRow.created_at : new Date().toISOString()
            };
        }

        // Requirement 6: When an anomaly is detected, log:
        // event: "Anomaly detected", location, resource, severity, deviation, timestamp
        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run(
                'ANOMALY_DETECTED',
                'Anomaly detected',
                locationFormatted,
                diagnostic.severity,
                `Resource: ${resourceType} | Severity: ${diagnostic.severity} | Observed: ${currentValue} ${unit} vs ${baseline} ${unit} (Deviation: ${diagnostic.deviationPercent > 0 ? '+' : ''}${diagnostic.deviationPercent}%)`
            );

        // Update or Insert in insights table
        try {
            db.prepare(`
                INSERT INTO insights (location, resource_type, observed_value, baseline_value, deviation_percent, cause, confidence, recommendation, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `).run(locationFormatted, resourceType, currentValue, baseline, diagnostic.deviationPercent, diagnostic.why, diagnostic.confidence, diagnostic.action);
        } catch (e) {}

    } else if (!isAnomaly && existingAlert) {
        // Auto-resolve ongoing alert when consumption normalizes
        db.prepare("UPDATE alerts SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolved_by = 'Auto Normalization', resolution_action = 'Telemetry Normalized' WHERE id = ?").run(existingAlert.id);

        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('ALERT_AUTO_RESOLVED', 'Alert Resolved', locationFormatted, 'RESOLVED', `Telemetry normalized to ${currentValue} ${unit} (within nominal baseline range).`);

        alertEvent = {
            id: existingAlert.id,
            resolved: true,
            location: locationFormatted,
            status: 'RESOLVED'
        };
    }

    // 10. Post-Action Telemetry & Impact Measurement (Step 5)
    let postActionImpact = null;
    try {
        const recentAction = db.prepare(`
            SELECT * FROM bms_actions 
            WHERE (location LIKE ? OR hotspot_id = ?)
            ORDER BY id DESC LIMIT 1
        `).get(`%${locationFormatted}%`, hotspotId);

        if (recentAction && recentAction.before_value) {
            const beforeVal = recentAction.before_value;
            if (currentValue < beforeVal) {
                const savedRes = parseFloat((beforeVal - currentValue).toFixed(2));
                const rate = resourceType === 'Water' ? COST_RATES.WATER_PER_LITER : COST_RATES.ELECTRICITY_PER_KWH;
                const costSaved = Math.round(savedRes * rate * 30);
                const reductionPct = Number((((beforeVal - currentValue) / beforeVal) * 100).toFixed(1));

                // Update BMS action record with verified telemetry
                db.prepare(`
                    UPDATE bms_actions 
                    SET post_action_value = ?, actual_saved = ?, impact_status = 'VERIFIED'
                    WHERE id = ?
                `).run(currentValue, savedRes, recentAction.id);

                // Record verification in audit log
                db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
                    .run(
                        'POST_ACTION_VERIFIED',
                        'Post-Action Telemetry Verified',
                        locationFormatted,
                        'SUCCESS',
                        `Post-action telemetry verified (${currentValue} ${unit}). Measured reduction of ${savedRes} ${unit} (-${reductionPct}%) vs pre-action (${beforeVal} ${unit}). Verified monthly cost avoidance: Rs. ${costSaved}.`
                    );

                postActionImpact = {
                    hasPostActionTelemetry: true,
                    beforeValue: beforeVal,
                    postActionValue: currentValue,
                    savedResource: savedRes,
                    costSaved,
                    reductionPercent: reductionPct,
                    message: `Mitigation Verified: Post-action consumption at ${locationFormatted} reduced by ${savedRes} ${unit} (-${reductionPct}%). Observed avoidable cost eliminated: Rs. ${costSaved}.`
                };
            }
        }
    } catch (e) {
        console.warn('[TelemetryEngine] Post-action impact verification error:', e.message);
    }

    if (postActionImpact) {
        diagnostic.postActionImpact = postActionImpact;
    }

    // 11. Record Ingestion in Audit Log
    db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
        .run('TELEMETRY_INGESTED', `Telemetry Ingested (${resourceType})`, locationFormatted, diagnostic.status, `Observed: ${currentValue} ${unit} vs ${baseline} ${unit} normal (${diagnostic.deviationPercent > 0 ? '+' : ''}${diagnostic.deviationPercent}%)`);

    // 12. Calculate Potential Savings across All Monitored Zones (Dynamic)
    const savingsData = calculateTotalPotentialSavings(facilityId);
    const potentialSavingsRs = savingsData.totalPotentialSavings;
    const activeAlertsCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

    const responseData = {
        success: true,
        message: 'Telemetry received successfully and processed by AI Engine.',
        readingId,
        location: locationFormatted,
        resourceType,
        value: currentValue,
        unit,
        baseline,
        occupancy,
        diagnostic,
        postActionImpact,
        hotspot: {
            id: hotspotId,
            building,
            room,
            currentValue,
            baseline,
            deviationPercent: diagnostic.deviationPercent,
            severity: diagnostic.severity,
            status: diagnostic.status
        },
        alert: alertEvent,
        activeAlerts: activeAlertsCount,
        potentialSavings: potentialSavingsRs,
        timestamp
    };

    // Broadcast SSE update
    broadcastTelemetryEvent({
        type: 'TELEMETRY_UPDATE',
        data: responseData
    });

    return responseData;
}

module.exports = {
    processTelemetryInput,
    registerSseClient,
    unregisterSseClient,
    broadcastTelemetryEvent
};