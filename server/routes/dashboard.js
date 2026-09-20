const express = require('express');
const router = express.Router();
const db = require('../database');
const { generatePredictionForecast, calculateTotalPotentialSavings } = require('../services/predictionEngine');
const { COST_RATES } = require('../services/anomalyEngine');

/**
 * ==========================================================================
 * NAXORA DASHBOARD ROUTER (Step 4 & 5)
 * Central Data Hub: Synchronized KPIs, Hotspots, Predictions, AI Diagnostics
 * ==========================================================================
 */

router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || req.query.facility_id || 'campus';
        const hotspots = db.prepare("SELECT * FROM hotspots WHERE facility_id = ? ORDER BY CASE severity WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 WHEN 'LOW' THEN 4 ELSE 5 END").all(facilityId);
        const alerts = db.prepare("SELECT * FROM alerts WHERE status = 'ACTIVE' ORDER BY id DESC").all();
        const devices = db.prepare('SELECT * FROM iot_devices WHERE facility_id = ?').all(facilityId);

        const topHotspot = hotspots.find(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM') || hotspots[0];
        const isSpike = topHotspot && (topHotspot.severity === 'CRITICAL' || topHotspot.severity === 'HIGH' || topHotspot.severity === 'MEDIUM');
        const activeLocation = topHotspot ? (topHotspot.room && topHotspot.room !== topHotspot.building ? `${topHotspot.building} - ${topHotspot.room}` : topHotspot.building) : 'Block A - Room 204';
        const activeBuilding = topHotspot ? topHotspot.building : 'Block A';
        const activeRoom = topHotspot ? (topHotspot.room || 'Room 204') : 'Room 204';
        const activeResource = topHotspot ? topHotspot.resource_type : 'Electricity';
        const activeUnit = activeResource === 'Water' ? 'L' : 'kWh';

        let elecKwh = 620;
        let waterL = 45;

        const elecHotspot = hotspots.find(h => (h.resource_type === 'Electricity' || !h.resource_type) && (h.severity === 'CRITICAL' || h.severity === 'HIGH')) || hotspots.find(h => h.id === 'block-a') || hotspots[0];
        if (elecHotspot) {
            elecKwh = elecHotspot.current_value;
        }

        const waterHotspot = hotspots.find(h => h.resource_type === 'Water' && (h.severity === 'CRITICAL' || h.severity === 'HIGH')) || hotspots.find(h => h.id === 'canteen');
        if (waterHotspot) {
            waterL = waterHotspot.current_value;
        }

        // 1. Dynamic Potential Savings Calculation (No hardcoded additions)
        const savingsObj = calculateTotalPotentialSavings(facilityId);
        const potentialSavings = savingsObj.totalPotentialSavings;

        const latestReadingRow = db.prepare('SELECT * FROM resource_readings WHERE facility_id = ? ORDER BY id DESC LIMIT 1').get(facilityId);
        const topAlert = alerts[0];

        // 2. Dynamic 7-Day Statistical Forecast
        const forecastObj = generatePredictionForecast(facilityId, activeLocation);

        const confVal = topHotspot ? topHotspot.confidence : 96;
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

        res.json({
            brand: 'NAXORA',
            tagline: 'AI Campus Resource Guardian',
            facilityId,
            activeAlerts: alerts.length,
            kpis: {
                electricity: {
                    value: `${elecKwh.toLocaleString()} kWh`,
                    trend: isSpike && elecHotspot ? `↑ +${elecHotspot.deviation_percent || 0}% vs baseline` : '↓ Nominal baseline',
                    status: (elecHotspot && elecHotspot.severity === 'CRITICAL') ? 'CRITICAL' : ((elecHotspot && elecHotspot.severity === 'HIGH') ? 'HIGH' : 'OPTIMAL')
                },
                water: {
                    value: `${waterL.toLocaleString()} L`,
                    trend: waterHotspot && (waterHotspot.severity === 'HIGH' || waterHotspot.severity === 'CRITICAL') ? `↑ +${waterHotspot.deviation_percent}% leak flow` : '↓ Nominal baseline',
                    status: waterHotspot && (waterHotspot.severity === 'HIGH' || waterHotspot.severity === 'CRITICAL') ? 'HIGH' : 'NORMAL'
                },
                activeAlerts: {
                    value: alerts.length,
                    subtext: alerts.length > 0 ? 'Needs Immediate Action' : 'All Zones Nominal',
                    severity: alerts.length > 0 ? 'HIGH' : 'NORMAL'
                },
                potentialSavings: {
                    value: `Rs. ${potentialSavings.toLocaleString()}`,
                    subtext: 'This Month (Recoverable)',
                    status: 'OPTIMAL'
                }
            },
            aiInsight: {
                title: isSpike ? (activeResource === 'Water' ? 'Continuous Water Flow Anomaly' : `${activeResource} Anomaly`) : 'Nominal Baseline Monitoring',
                hotspotId: topHotspot ? topHotspot.id : 'block-a',
                building: activeBuilding,
                room: activeRoom,
                location: activeLocation,
                resourceType: activeResource,
                currentConsumption: `${topHotspot ? topHotspot.current_value : elecKwh} ${activeUnit}`,
                normalBaseline: `${topHotspot ? topHotspot.baseline_value : 620} ${activeUnit}`,
                deviation: isSpike ? `${topHotspot.deviation_percent > 0 ? '+' : ''}${topHotspot.deviation_percent}%` : '0%',
                deviationPercent: topHotspot ? topHotspot.deviation_percent : 0,
                confidence: `${confVal}%`,
                confidenceVal: confVal,
                confidenceLabel: confLabel,
                isLowConfidence: isLowConf,
                rootCause: topHotspot ? topHotspot.reason : 'Optimal energy efficiency verified across active zones.',
                reason: topHotspot ? topHotspot.reason : 'Optimal energy efficiency verified across active zones.',
                why: topHotspot ? topHotspot.reason : 'Optimal energy efficiency verified across active zones.',
                action: topHotspot ? topHotspot.recommended_action : 'Maintain standard continuous baseline monitoring.',
                suggestedAction: topHotspot ? topHotspot.recommended_action : 'Maintain standard continuous baseline monitoring.',
                recommendedAction: topHotspot ? topHotspot.recommended_action : 'Maintain standard continuous baseline monitoring.',
                severity: topHotspot ? topHotspot.severity : 'NORMAL',
                status: isSpike ? 'ACTIVE' : 'MITIGATED'
            },
            futurePrediction: {
                title: '30-DAY PREDICTIVE FORECAST',
                targetLocation: activeLocation,
                monthlyWaste: isSpike ? `${forecastObj.projected_wastage} ${activeUnit}` : `0 ${activeUnit}`,
                predictedCostImpact: isSpike ? `Rs. ${forecastObj.avoidable_cost.toLocaleString()}/month` : 'Rs. 0/month',
                financialImpact: isSpike ? `Rs. ${forecastObj.avoidable_cost.toLocaleString()}/month` : 'Rs. 0/month',
                riskLevel: forecastObj.risk_level,
                confidence: `${confVal}%`,
                confidenceLabel: confLabel,
                hasSufficientData: forecastObj.hasSufficientData,
                summary: forecastObj.summary,
                forecastChart: forecastObj
            },
            priorityAlert: topAlert ? {
                id: topAlert.id,
                location: topAlert.location,
                title: topAlert.title,
                message: topAlert.message,
                resourceType: topAlert.resource_type,
                current: `${topAlert.current_value || (topAlert.resource_type === 'Water' ? 240 : elecKwh)} ${topAlert.resource_type === 'Water' ? 'L' : 'kWh'}`,
                currentValue: `${topAlert.current_value || (topAlert.resource_type === 'Water' ? 240 : elecKwh)} ${topAlert.resource_type === 'Water' ? 'L' : 'kWh'}`,
                baseline: `${topAlert.baseline_value || (topAlert.resource_type === 'Water' ? 45 : 620)} ${topAlert.resource_type === 'Water' ? 'L' : 'kWh'}`,
                baselineValue: `${topAlert.baseline_value || (topAlert.resource_type === 'Water' ? 45 : 620)} ${topAlert.resource_type === 'Water' ? 'L' : 'kWh'}`,
                deviation: `${topAlert.deviation_percent > 0 ? '+' : ''}${topAlert.deviation_percent}%`,
                severity: topAlert.severity,
                confidence: `${confVal}%`,
                hotspotId: topAlert.hotspot_id
            } : {
                location: 'Campus Monitored Zones',
                title: 'ALL ZONES NOMINAL',
                message: 'All monitored facilities are operating within calibrated baseline efficiency bands.',
                current: 'Nominal',
                currentValue: 'Nominal',
                baseline: 'Nominal',
                baselineValue: 'Nominal',
                deviation: '0%',
                severity: 'NORMAL',
                confidence: '98%',
                hotspotId: 'campus'
            },
            bmsTarget: {
                hotspotId: topHotspot ? topHotspot.id : 'block-a',
                location: activeLocation,
                title: 'APPLY AUTOMATED BMS SHUTDOWN',
                description: `Executing automated shutdown of non-essential loads at ${activeLocation}.`
            },
            telemetryStatus: {
                streamStatus: 'ACTIVE',
                source: 'ESP32 / Telemetry Stream',
                roomsMonitored: 24,
                sensorsOnline: `${devices.filter(d => d.status === 'ONLINE').length} / ${devices.length || 8}`,
                latestReading: latestReadingRow ? {
                    location: latestReadingRow.room_id && latestReadingRow.room_id !== latestReadingRow.building_id ? `${latestReadingRow.building_id} - ${latestReadingRow.room_id}` : latestReadingRow.building_id,
                    value: `${latestReadingRow.value} ${latestReadingRow.unit}`,
                    occupancy: `${latestReadingRow.occupancy} Occ`,
                    status: topHotspot ? topHotspot.status : 'Normal'
                } : {
                    location: 'Block A - Room 204',
                    value: `${elecKwh} kWh`,
                    occupancy: '0 Occ',
                    status: isSpike ? 'Critical' : 'Normal'
                }
            },
            hotspots,
            alerts
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch dashboard data', details: err.message });
    }
});

module.exports = router;
