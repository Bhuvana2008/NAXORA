const express = require('express');
const router = express.Router();
const db = require('../database');
const { evaluateAnomaly, COST_RATES } = require('../services/anomalyEngine');

/**
 * ==========================================================================
 * NAXORA ACTIONS & SIMULATION ROUTER (Step 5)
 * BMS Mitigation Controller, Safety Validations, and Event Injector
 * ==========================================================================
 */

/**
 * Handles Automated BMS Shutdown Mitigation with Action Safety Checks
 */
const handleBmsShutdown = (req, res) => {
    try {
        const body = req.body || {};
        const alertId = body.alertId || body.alert_id || null;
        const requestedLoc = (body.location || '').toString().trim();
        const facilityId = (body.facility || body.facility_id || 'campus').toString().trim().toLowerCase();

        let targetAlert = null;
        let targetHotspot = null;

        // 1. Action Safety: Check by Alert ID if provided
        if (alertId) {
            targetAlert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
            if (!targetAlert) {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found',
                    message: 'Action safety check: The specified alert does not exist.'
                });
            }
            if (targetAlert.status === 'RESOLVED') {
                return res.status(400).json({
                    success: false,
                    error: 'Alert is already resolved',
                    message: 'Action safety check: The specified alert is already resolved.'
                });
            }
        }

        // 2. Action Safety: Check by Location if alertId not provided
        if (!targetAlert && requestedLoc) {
            const cleanKey = requestedLoc.toLowerCase().replace(/[^a-z0-9]/g, '-');
            targetAlert = db.prepare(`
                SELECT * FROM alerts 
                WHERE (location LIKE ? OR hotspot_id = ? OR hotspot_id LIKE ?) AND status = 'ACTIVE'
                ORDER BY id DESC LIMIT 1
            `).get(`%${requestedLoc}%`, requestedLoc, `%${cleanKey}%`);
        }

        // 3. Fallback: Find top active alert across the facility
        if (!targetAlert) {
            targetAlert = db.prepare("SELECT * FROM alerts WHERE status = 'ACTIVE' ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, id DESC LIMIT 1").get();
        }

        // 4. Find corresponding hotspot
        if (targetAlert && targetAlert.hotspot_id) {
            targetHotspot = db.prepare('SELECT * FROM hotspots WHERE id = ?').get(targetAlert.hotspot_id);
        }
        if (!targetHotspot && requestedLoc) {
            const cleanKey = requestedLoc.toLowerCase().replace(/[^a-z0-9]/g, '-');
            targetHotspot = db.prepare(`
                SELECT * FROM hotspots 
                WHERE id = ? OR id LIKE ? OR building LIKE ? OR (building || ' - ' || room) LIKE ?
                LIMIT 1
            `).get(requestedLoc, `%${cleanKey}%`, `%${requestedLoc.split(' - ')[0].trim()}%`, `%${requestedLoc}%`);
        }
        if (!targetHotspot && targetAlert && targetAlert.location) {
            const bldName = targetAlert.location.split(' - ')[0].trim();
            targetHotspot = db.prepare('SELECT * FROM hotspots WHERE building LIKE ? LIMIT 1').get(`%${bldName}%`);
        }
        if (!targetHotspot) {
            targetHotspot = db.prepare("SELECT * FROM hotspots WHERE severity IN ('CRITICAL', 'HIGH', 'MEDIUM') LIMIT 1").get() || db.prepare("SELECT * FROM hotspots WHERE id = 'block-a'").get();
        }

        if (!targetHotspot) {
            return res.status(400).json({
                success: false,
                error: 'No active anomaly target found',
                message: 'Action safety check: No active anomaly target requires BMS mitigation.'
            });
        }

        const hotspotId = targetHotspot.id;
        const targetLocation = targetAlert ? targetAlert.location : (targetHotspot.room && targetHotspot.room !== targetHotspot.building ? `${targetHotspot.building} - ${targetHotspot.room}` : targetHotspot.building);
        const resourceType = targetHotspot.resource_type || (targetAlert ? targetAlert.resource_type : 'Electricity');
        const isWater = resourceType.toLowerCase().includes('water');
        const unit = isWater ? 'L' : 'kWh';

        const beforeValue = targetHotspot.current_value;
        const baselineValue = targetHotspot.baseline_value;
        const savedResource = Math.max(0, beforeValue - baselineValue);
        const costRate = isWater ? COST_RATES.WATER_PER_LITER : COST_RATES.ELECTRICITY_PER_KWH;
        const costSaved = Math.round(savedResource * costRate * 30);

        // 5. Update Hotspot to Nominal State in SQLite
        db.prepare(`
            UPDATE hotspots SET
                current_value = baseline_value,
                deviation_percent = 0.0,
                severity = 'NORMAL',
                confidence = 96,
                status = 'NORMAL',
                recommended_action = 'BMS Action Applied. Idle sub-circuits isolated and returned to nominal baseline.',
                reason = 'Optimal resource efficiency verified against calibrated baseline.'
            WHERE id = ?
        `).run(hotspotId);

        // 6. Update Alert to RESOLVED with metadata
        if (targetAlert) {
            db.prepare(`
                UPDATE alerts SET
                    status = 'RESOLVED',
                    resolved_at = CURRENT_TIMESTAMP,
                    resolved_by = 'BMS Automation',
                    resolution_action = 'BMS Action Applied'
                WHERE id = ?
            `).run(targetAlert.id);
        } else {
            db.prepare(`
                UPDATE alerts SET
                    status = 'RESOLVED',
                    resolved_at = CURRENT_TIMESTAMP,
                    resolved_by = 'BMS Automation',
                    resolution_action = 'BMS Action Applied'
                WHERE (hotspot_id = ? OR location LIKE ?) AND status = 'ACTIVE'
            `).run(hotspotId, `%${targetLocation}%`);
        }

        // 7. Record BMS Action in bms_actions ledger
        db.prepare(`
            INSERT INTO bms_actions (hotspot_id, location, action, status, before_value, estimated_saving_kwh, estimated_saving_cost, impact_status)
            VALUES (?, ?, 'BMS Action Applied', 'EXECUTED', ?, ?, ?, 'PENDING')
        `).run(hotspotId, targetLocation, beforeValue, isWater ? 0 : savedResource, costSaved);

        // 8. Record in Immutable Audit Log (Step 5 & 6 Requirement)
        const currentIso = new Date().toISOString();
        db.prepare("INSERT INTO audit_logs (action, event, location, status, details, timestamp) VALUES (?, ?, ?, ?, ?, ?)")
            .run(
                'BMS_SHUTDOWN',
                'BMS Action Applied',
                targetLocation,
                'SUCCESS',
                `BMS shutdown command simulated: Sub-circuits isolated at ${targetLocation}. Pre-action load: ${beforeValue} ${unit}, Target baseline: ${baselineValue} ${unit}. Estimated monthly cost avoidance: Rs. ${costSaved}.`,
                currentIso
            );

        // 9. Update matching insights
        try {
            db.prepare("UPDATE insights SET status = 'RESOLVED' WHERE location LIKE ?").run(`%${targetLocation}%`);
        } catch (e) {}

        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

        res.json({
            success: true,
            message: `BMS Action Applied: Non-essential sub-circuits isolated at ${targetLocation}. Consumption normalized to ${baselineValue} ${unit}.`,
            action: 'BMS Action Applied',
            status: 'EXECUTED',
            location: targetLocation,
            resourceType,
            unit,
            beforeValue,
            mitigatedValue: baselineValue,
            savedResource,
            energySavedKwh: isWater ? 0 : savedResource,
            waterSavedL: isWater ? savedResource : 0,
            costSavedRs: costSaved,
            activeAlerts: activeCount,
            postActionStatus: 'Awaiting post-action telemetry'
        });
    } catch (err) {
        res.status(500).json({ error: 'BMS shutdown failed', details: err.message });
    }
};

router.post('/power-spike', (req, res) => {
    try {
        const spikeCurrent = 1846;
        const baseline = 620;
        const evalResult = evaluateAnomaly(spikeCurrent, baseline, 'Electricity', 0);

        db.prepare(`
            UPDATE hotspots SET
                current_value = ?,
                deviation_percent = ?,
                severity = 'CRITICAL',
                confidence = ?,
                status = 'CRITICAL',
                recommended_action = 'Inspect equipment and apply automated BMS shutdown.',
                reason = 'HVAC and GPU equipment consuming power during zero occupancy.'
            WHERE id = 'block-a'
        `).run(spikeCurrent, evalResult.deviationPercent, evalResult.confidence);

        const newAlert = db.prepare(`
            INSERT INTO alerts (hotspot_id, severity, title, message, location, resource_type, deviation_percent, status)
            VALUES ('block-a', 'CRITICAL', 'Severe Electrical Anomaly', 'Abnormal electricity consumption detected in Block A, Room 204 (+139% above baseline).', 'Block A - Room 204', 'Electricity', 139.7, 'ACTIVE')
        `).run();

        db.prepare("INSERT INTO simulation_events (event_type, target_location, payload) VALUES (?, ?, ?)")
            .run('POWER_SPIKE', 'Block A - Room 204', JSON.stringify({ spikeCurrent, baseline, deviation: evalResult.deviationPercent }));

        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('SIMULATION_SPIKE', 'Simulate Power Spike', 'Block A - Room 204', 'CRITICAL', 'Power spike injected (+139% above baseline, 1846 kWh draw)');

        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

        res.json({
            success: true,
            message: 'Power surge injected: Block A Room 204 (+139.7% above baseline)!',
            event: 'POWER_SPIKE',
            deviationPercent: evalResult.deviationPercent,
            alertId: newAlert.lastInsertRowid,
            activeAlerts: activeCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Power spike simulation failed', details: err.message });
    }
});

router.post('/water-leak', (req, res) => {
    try {
        const leakCurrent = 940;
        const baseline = 310;
        const evalResult = evaluateAnomaly(leakCurrent, baseline, 'Water', 1);

        db.prepare(`
            UPDATE hotspots SET
                current_value = ?,
                deviation_percent = ?,
                severity = 'HIGH',
                confidence = ?,
                status = 'HIGH',
                recommended_action = 'Isolate wash valve #03 and inspect main pipe seal.',
                reason = 'Continuous water flow surge exceeding wash basin baseline.'
            WHERE id = 'canteen'
        `).run(leakCurrent, evalResult.deviationPercent, evalResult.confidence);

        const newAlert = db.prepare(`
            INSERT INTO alerts (hotspot_id, severity, title, message, location, resource_type, deviation_percent, status)
            VALUES ('canteen', 'HIGH', 'Water Leak Detected', 'Continuous flow valve leakage identified in Main Canteen (+203% above baseline).', 'Main Canteen - Wash Station', 'Water', 203.2, 'ACTIVE')
        `).run();

        db.prepare("INSERT INTO simulation_events (event_type, target_location, payload) VALUES (?, ?, ?)")
            .run('WATER_LEAK', 'Main Canteen', JSON.stringify({ leakCurrent, baseline }));

        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('SIMULATION_WATER', 'Simulate Water Leak', 'Main Canteen', 'HIGH', 'Water leak injected in Canteen wash station (+203% above baseline, 940 L)');

        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

        res.json({
            success: true,
            message: 'AI detected abnormal water consumption. Canteen leak alert dispatched!',
            event: 'WATER_LEAK',
            alertId: newAlert.lastInsertRowid,
            activeAlerts: activeCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Water leak simulation failed', details: err.message });
    }
});

const handleResetBaseline = (req, res) => {
    try {
        db.prepare(`
            UPDATE hotspots SET
                current_value = baseline_value,
                deviation_percent = 0.0,
                severity = 'NORMAL',
                confidence = 98,
                status = 'NORMAL',
                recommended_action = 'System nominal. Maintain standard monitoring.'
            WHERE id IN ('block-a', 'canteen')
        `).run();

        db.prepare("UPDATE alerts SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP WHERE status = 'ACTIVE'").run();

        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('SIMULATION_RESET', 'Reset Simulation / Baseline', 'Campus Wide', 'NORMAL', 'All simulated surges and leaks cleared. Baseline restored.');

        res.json({
            success: true,
            message: 'All simulated surges and leaks cleared. Campus returned to nominal baseline.',
            event: 'BASELINE_RESTORED',
            activeAlerts: 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Simulation reset failed', details: err.message });
    }
};

router.post('/bms-shutdown', handleBmsShutdown);
router.post('/reset', handleResetBaseline);
router.post('/baseline', handleResetBaseline);

module.exports = { router, handleBmsShutdown };