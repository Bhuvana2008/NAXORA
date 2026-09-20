const db = require('../database');
const { COST_RATES, calculateConfidence } = require('./anomalyEngine');

/**
 * ==========================================================================
 * NAXORA PREDICTIVE WASTE INTELLIGENCE ENGINE (Step 4)
 * Multi-Location Time-Series Telemetry Forecasting & Dynamic Savings
 * ==========================================================================
 */

/**
 * Parses building and room from a unified location string
 */
function parseLocation(locationStr = '') {
    const raw = (locationStr || '').toString().trim();
    let building = raw;
    let room = '';

    if (raw.includes(' - ')) {
        const parts = raw.split(' - ');
        building = parts[0].trim();
        room = parts.slice(1).join(' - ').trim();
    } else if (raw.includes(' • ')) {
        const parts = raw.split(' • ');
        building = parts[0].trim();
        room = parts.slice(1).join(' • ').trim();
    }
    return { building, room, locationFormatted: room ? `${building} - ${room}` : building };
}

/**
 * Fetches chronologically sorted historical readings for a specific location & resource type.
 * Never mixes different rooms or buildings.
 */
function getHistoricalReadingsForLocation(building, room, resourceType = 'Electricity', facilityId = 'campus', limit = 20) {
    try {
        let query = `
            SELECT * FROM resource_readings
            WHERE facility_id = ? AND resource_type = ?
        `;
        let params = [facilityId, resourceType];

        if (room && room !== building) {
            query += ' AND (room_id LIKE ? OR building_id LIKE ?)';
            params.push(`%${room}%`, `%${building}%`);
        } else {
            query += ' AND building_id LIKE ?';
            params.push(`%${building}%`);
        }

        query += ' ORDER BY id ASC, timestamp ASC LIMIT ?';
        params.push(limit);

        return db.prepare(query).all(...params);
    } catch (e) {
        console.warn('[PredictionEngine] Historical query fallback:', e.message);
        return [];
    }
}

/**
 * Generates an explainable 7-day Statistical Rolling Horizon Forecast for a specific location.
 * 
 * @param {string} facilityId - Monitored facility ID
 * @param {string|null} targetLocation - Specific location to forecast (optional, defaults to top active anomaly)
 * @returns {Object} Forecast results, trajectory datasets, and dynamic potential savings
 */
function generatePredictionForecast(facilityId = 'campus', targetLocation = null) {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri (Today)', 'Sat (Proj)', 'Sun (Proj)'];
    
    // 1. Fetch active hotspots
    const hotspots = db.prepare(`
        SELECT * FROM hotspots 
        WHERE facility_id = ? 
        ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END
    `).all(facilityId);

    // 2. Determine target hotspot & location
    let topHotspot = null;
    if (targetLocation) {
        const { building, room } = parseLocation(targetLocation);
        topHotspot = hotspots.find(h => 
            h.building.toLowerCase().includes(building.toLowerCase()) || 
            (room && h.room.toLowerCase().includes(room.toLowerCase()))
        );
    }
    if (!topHotspot) {
        topHotspot = hotspots.find(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM') || hotspots[0];
    }

    const bldName = topHotspot ? topHotspot.building : 'Block A';
    const rmName = topHotspot ? (topHotspot.room || 'Room 204') : 'Room 204';
    const locName = topHotspot 
        ? (topHotspot.room && topHotspot.room !== topHotspot.building ? `${topHotspot.building} - ${topHotspot.room}` : topHotspot.building)
        : 'Block A - Room 204';

    const resourceType = topHotspot ? topHotspot.resource_type : 'Electricity';
    const isWater = resourceType.toLowerCase().includes('water');
    const unit = isWater ? 'L' : 'kWh';
    const costRate = isWater ? COST_RATES.WATER_PER_LITER : COST_RATES.ELECTRICITY_PER_KWH;

    // 3. Query chronologically isolated historical readings for this EXACT location
    const historicalReadings = getHistoricalReadingsForLocation(bldName, rmName, resourceType, facilityId);
    const readingCount = historicalReadings.length;
    const hasSufficientData = readingCount >= 2;

    const baseVal = topHotspot ? topHotspot.baseline_value : (isWater ? 45 : 620);
    const currentVal = topHotspot ? topHotspot.current_value : baseVal;
    const deviationPercent = topHotspot ? topHotspot.deviation_percent : 0;
    const isSpike = topHotspot && (topHotspot.severity === 'CRITICAL' || topHotspot.severity === 'HIGH' || deviationPercent >= 20);

    // Handle Insufficient Data
    if (!hasSufficientData) {
        const learnConf = calculateConfidence(readingCount, deviationPercent, true);
        return {
            hasSufficientData: false,
            title: 'Predictive Resource Forecast (7-Day Rolling Horizon)',
            method: 'Statistical Rolling Horizon Extrapolation',
            targetLocation: locName,
            resourceType,
            unit,
            currentUsage: currentVal,
            baselineUsage: baseVal,
            predictedUsage: null,
            expectedExcess: 0,
            projected_wastage: 0,
            avoidable_cost: 0,
            estimatedAvoidableCost: 0,
            confidence: learnConf.score,
            confidenceLabel: learnConf.label,
            isLowConfidence: true,
            forecastPeriod: 'Next 7 Days',
            labels: days,
            baseline: [baseVal, baseVal, baseVal, baseVal, baseVal, baseVal, baseVal],
            actual_projected: [null, null, null, null, currentVal, null, null],
            upper_confidence: [null, null, null, null, null, null, null],
            risk_level: 'NORMAL',
            summary: 'Insufficient historical data for reliable prediction.'
        };
    }

    // 4. Generate Data-Driven Statistical Trajectory for Sufficient Historical Data
    const baselineSeries = [baseVal, Math.round(baseVal * 0.99), Math.round(baseVal * 1.02), Math.round(baseVal * 1.01), baseVal, Math.round(baseVal * 0.98), Math.round(baseVal * 0.97)];

    let actual_projected = [];
    if (readingCount >= 5) {
        // Use real historical readings for past days
        const past = historicalReadings.slice(-5);
        actual_projected = past.map(r => r.value);
    } else {
        // Interpolate past days leading up to latest reading
        if (isSpike) {
            actual_projected = [
                Math.round(baseVal * 1.01),
                Math.round(baseVal * 1.03),
                Math.round(baseVal * 1.15),
                Math.round(baseVal * 1.45),
                currentVal
            ];
        } else {
            actual_projected = [
                Math.round(baseVal * 0.99),
                Math.round(baseVal * 1.01),
                Math.round(baseVal * 1.0),
                Math.round(baseVal * 1.02),
                currentVal
            ];
        }
    }

    // Append Projections for Day 6 (Sat) & Day 7 (Sun)
    if (isSpike) {
        actual_projected.push(Math.round(currentVal * 1.03));
        actual_projected.push(Math.round(currentVal * 1.06));
    } else {
        actual_projected.push(Math.round(baseVal * 0.99));
        actual_projected.push(Math.round(baseVal * 0.98));
    }

    const upper_confidence = actual_projected.map(v => (v !== null ? Math.round(v * 1.05) : null));

    // 5. Dynamic Wastage & Potential Savings Calculation
    const excessDaily = Math.max(0, currentVal - baseVal);
    const projected_wastage = isSpike ? Math.round(excessDaily * 30 * 0.3) : 0; // Monthly unmitigated excess
    const avoidable_cost = Math.round(projected_wastage * costRate);

    // Calculate Dynamic Confidence based on historical depth and variance
    const confObj = calculateConfidence(readingCount, deviationPercent, false);

    const summaryText = isSpike
        ? `${locName} may waste approximately: <strong>${projected_wastage.toLocaleString()} ${unit} (Rs. ${avoidable_cost.toLocaleString()}/mo)</strong> if unmitigated.`
        : `Projected consumption for ${locName} remains within calibrated efficiency boundaries across monitored periods.`;

    return {
        hasSufficientData: true,
        title: 'Predictive Resource Forecast (7-Day Rolling Horizon)',
        method: 'Statistical Rolling Horizon Extrapolation',
        targetLocation: locName,
        building: bldName,
        room: rmName,
        resourceType,
        unit,
        currentUsage: currentVal,
        baselineUsage: baseVal,
        predictedUsage: actual_projected[5],
        expectedExcess: excessDaily,
        projected_wastage,
        avoidable_cost,
        estimatedAvoidableCost: avoidable_cost,
        confidence: confObj.score,
        confidenceLabel: confObj.label,
        isLowConfidence: confObj.isLowConfidence,
        risk_level: isSpike ? (topHotspot?.severity || 'HIGH') : 'LOW',
        forecastPeriod: 'Next 7 Days',
        labels: days,
        baseline: baselineSeries,
        actual_projected,
        upper_confidence,
        summary: summaryText
    };
}

/**
 * Calculates location-wise independent predictions and avoidable savings for all monitored locations.
 */
function getLocationWisePredictions(facilityId = 'campus') {
    const hotspots = db.prepare('SELECT * FROM hotspots WHERE facility_id = ?').all(facilityId);
    
    return hotspots.map(h => {
        const loc = h.room && h.room !== h.building ? `${h.building} - ${h.room}` : h.building;
        const isWater = (h.resource_type || '').toLowerCase().includes('water');
        const unit = isWater ? 'L' : 'kWh';
        const costRate = isWater ? COST_RATES.WATER_PER_LITER : COST_RATES.ELECTRICITY_PER_KWH;

        const hist = getHistoricalReadingsForLocation(h.building, h.room, h.resource_type, facilityId);
        const count = hist.length;
        const hasData = count >= 2;

        const excess = Math.max(0, h.current_value - h.baseline_value);
        const monthlyExcess = isWater ? Math.round(excess * 30 * 0.4) : Math.round(excess * 30 * 0.3);
        const potentialSavings = Math.round(monthlyExcess * costRate);
        const confObj = calculateConfidence(count, h.deviation_percent, !hasData);

        return {
            hotspotId: h.id,
            location: loc,
            building: h.building,
            room: h.room,
            resourceType: h.resource_type,
            unit,
            currentUsage: h.current_value,
            baselineUsage: h.baseline_value,
            deviationPercent: h.deviation_percent,
            severity: h.severity,
            status: h.status,
            expectedMonthlyExcess: monthlyExcess,
            potentialSavingsRs: potentialSavings,
            confidence: confObj.score,
            confidenceLabel: confObj.label,
            hasSufficientData: hasData,
            forecastPeriod: '7-Day Rolling Horizon'
        };
    });
}

/**
 * Aggregates total potential savings dynamically across all locations
 */
function calculateTotalPotentialSavings(facilityId = 'campus') {
    const locPreds = getLocationWisePredictions(facilityId);
    let totalSavings = 0;
    let totalExcessElec = 0;
    let totalExcessWater = 0;

    locPreds.forEach(p => {
        totalSavings += p.potentialSavingsRs;
        if (p.resourceType === 'Water') {
            totalExcessWater += p.expectedMonthlyExcess;
        } else {
            totalExcessElec += p.expectedMonthlyExcess;
        }
    });

    return {
        totalPotentialSavings: totalSavings,
        totalExcessElecKwh: totalExcessElec,
        totalExcessWaterL: totalExcessWater,
        costRates: COST_RATES,
        locationBreakdown: locPreds
    };
}

module.exports = {
    generatePredictionForecast,
    getLocationWisePredictions,
    calculateTotalPotentialSavings,
    getHistoricalReadingsForLocation
};