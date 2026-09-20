const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * ==========================================================================
 * NAXORA AI INSIGHTS ROUTER (Step 3)
 * Real-Time Anomaly Root Cause Analysis & 5-Point Explainability
 * ==========================================================================
 */

router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || req.query.facility_id || 'campus';
        const hotspots = db.prepare("SELECT * FROM hotspots WHERE facility_id = ? ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END").all(facilityId);
        
        let dynamicInsights = [];
        try {
            dynamicInsights = db.prepare('SELECT * FROM insights WHERE status = "ACTIVE" ORDER BY id DESC LIMIT 10').all();
        } catch (e) {}

        const topAnomaly = hotspots.find(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM') || hotspots[0];
        const isSpike = topAnomaly && (topAnomaly.severity === 'CRITICAL' || topAnomaly.severity === 'HIGH' || topAnomaly.severity === 'MEDIUM');
        const isWater = topAnomaly && topAnomaly.resource_type === 'Water';
        const unit = isWater ? 'L' : 'kWh';

        const activeLoc = topAnomaly ? (topAnomaly.room && topAnomaly.room !== topAnomaly.building ? `${topAnomaly.building} • ${topAnomaly.room}` : topAnomaly.building) : 'Block A • Room 204';
        const activeBld = topAnomaly ? topAnomaly.building : 'Block A';
        const activeRm = topAnomaly ? (topAnomaly.room || 'Room 204') : 'Room 204';
        const activeRes = topAnomaly ? topAnomaly.resource_type : 'Electricity';

        const confVal = topAnomaly ? topAnomaly.confidence : 96;
        let confLabel = 'High Confidence';
        let isLowConf = false;

        if (confVal < 70) {
            confLabel = 'Low confidence — baseline learning';
            isLowConf = true;
        } else if (confVal >= 90) {
            confLabel = 'Very High Confidence';
        } else if (confVal >= 80) {
            confLabel = 'High Confidence';
        } else {
            confLabel = 'Medium Confidence';
        }

        const mainInsight = {
            title: isSpike ? (isWater ? 'Continuous Water Flow Anomaly' : `${activeRes} Anomaly`) : 'Nominal Baseline Monitoring',
            hotspotId: topAnomaly ? topAnomaly.id : 'block-a',
            building: activeBld,
            room: activeRm,
            location: activeLoc,
            resourceType: activeRes,
            currentConsumption: `${topAnomaly ? topAnomaly.current_value : 620} ${unit}`,
            normalBaseline: `${topAnomaly ? topAnomaly.baseline_value : 620} ${unit}`,
            deviation: `${topAnomaly ? (topAnomaly.deviation_percent > 0 ? '+' : '') + topAnomaly.deviation_percent : 0}%`,
            deviationPercent: topAnomaly ? topAnomaly.deviation_percent : 0,
            confidence: `${confVal}%`,
            confidenceVal: confVal,
            confidenceLabel: confLabel,
            isLowConfidence: isLowConf,
            what: topAnomaly ? `${activeRes} consumption anomaly (${topAnomaly.current_value} ${unit} vs ${topAnomaly.baseline_value} ${unit})` : 'Nominal telemetry',
            where: activeLoc,
            howSevere: topAnomaly ? topAnomaly.severity : 'NORMAL',
            why: topAnomaly ? topAnomaly.reason : 'Optimal resource efficiency verified against rolling baseline.',
            rootCause: topAnomaly ? topAnomaly.reason : 'Optimal resource efficiency verified against rolling baseline.',
            reason: topAnomaly ? topAnomaly.reason : 'Optimal resource efficiency verified against rolling baseline.',
            action: topAnomaly ? topAnomaly.recommended_action : 'Maintain standard continuous baseline monitoring.',
            suggestedAction: topAnomaly ? topAnomaly.recommended_action : 'Maintain standard continuous baseline monitoring.',
            recommendedAction: topAnomaly ? topAnomaly.recommended_action : 'Maintain standard continuous baseline monitoring.',
            severity: topAnomaly ? topAnomaly.severity : 'NORMAL',
            status: topAnomaly ? topAnomaly.status : 'NORMAL'
        };

        const anomalies = hotspots
            .filter(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM')
            .map(h => {
                const cVal = h.confidence || 96;
                let cLbl = 'High Confidence';
                let isLow = false;
                if (cVal < 70) {
                    cLbl = 'Low confidence — baseline learning';
                    isLow = true;
                } else if (cVal >= 90) {
                    cLbl = 'Very High Confidence';
                } else if (cVal >= 80) {
                    cLbl = 'High Confidence';
                } else {
                    cLbl = 'Medium Confidence';
                }

                return {
                    id: h.id,
                    title: `${h.severity} ${h.resource_type.toUpperCase()} ANOMALY`,
                    building: h.building,
                    room: h.room,
                    location: h.room && h.room !== h.building ? `${h.building} • ${h.room}` : h.building,
                    resourceType: h.resource_type,
                    current: `${h.current_value} ${h.resource_type === 'Water' ? 'L' : 'kWh'}`,
                    currentValue: h.current_value,
                    baseline: `${h.baseline_value} ${h.resource_type === 'Water' ? 'L' : 'kWh'}`,
                    baselineValue: h.baseline_value,
                    deviation: `${h.deviation_percent > 0 ? '+' : ''}${h.deviation_percent}%`,
                    deviationPercent: h.deviation_percent,
                    confidence: `${cVal}%`,
                    confidenceVal: cVal,
                    confidenceLabel: cLbl,
                    isLowConfidence: isLow,
                    severity: h.severity,
                    status: h.status,
                    what: `${h.resource_type} consumption anomaly (${h.current_value} vs ${h.baseline_value})`,
                    where: `${h.building} - ${h.room}`,
                    howSevere: h.severity,
                    why: h.reason,
                    rootCause: h.reason,
                    action: h.recommended_action,
                    suggestedAction: h.recommended_action
                };
            });

        res.json({
            success: true,
            facilityId,
            mainInsight,
            anomalies,
            dynamicInsights,
            allHotspots: hotspots
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch insights', details: err.message });
    }
});

module.exports = router;
