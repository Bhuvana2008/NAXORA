const express = require('express');
const router = express.Router();
const db = require('../database');
const { calculateTotalPotentialSavings } = require('../services/predictionEngine');

/**
 * ==========================================================================
 * NAXORA REPORTS & ESG IMPACT ROUTER (Step 4 & 5)
 * Dynamic Resource Efficiency Scoring & Environmental Compliance Metrics
 * ==========================================================================
 */

router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || req.query.facility_id || 'campus';
        const period = req.query.period || '30days';

        const hotspots = db.prepare('SELECT * FROM hotspots WHERE facility_id = ?').all(facilityId);
        const readingsCount = db.prepare('SELECT COUNT(*) as count FROM resource_readings WHERE facility_id = ?').get(facilityId).count;
        const alertsResolved = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'RESOLVED'").get().count;
        const bmsActions = db.prepare('SELECT * FROM bms_actions ORDER BY id DESC LIMIT 10').all();

        // Check if sufficient data exists
        if (hotspots.length === 0 && readingsCount === 0) {
            return res.json({
                period,
                facilityId,
                efficiencyScore: 'Insufficient data',
                efficiencyScoreNum: null,
                carbonPrevented: 'Insufficient data',
                waterConserved: 'Insufficient data',
                potentialSavings: 'Insufficient data',
                energyReductionPercent: 'Insufficient data',
                resolvedAlertsCount: alertsResolved,
                recentBmsActions: bmsActions,
                hotspotsSummary: hotspots,
                summary: {
                    efficiency_score: null,
                    carbon_prevented: 'Insufficient data',
                    water_conserved: 'Insufficient data',
                    potential_savings: null
                }
            });
        }

        // 1. Dynamic Resource Efficiency Score Calculation
        let totalCurrentElec = 0;
        let totalBaseElec = 0;
        hotspots.forEach(h => {
            if (h.resource_type === 'Electricity' || !h.resource_type) {
                totalCurrentElec += (h.current_value || 0);
                totalBaseElec += (h.baseline_value || 0);
            }
        });

        let effScore = 88;
        if (totalBaseElec > 0) {
            const devRatio = (totalCurrentElec - totalBaseElec) / totalBaseElec;
            if (devRatio > 0) {
                effScore = Math.max(20, Math.min(99, Math.round(100 - (devRatio * 35))));
            } else {
                effScore = Math.min(100, Math.round(92 + Math.abs(devRatio * 8)));
            }
        }

        // 2. Dynamic Carbon Prevented (CO2e avoided via BMS mitigations)
        let savedKwhSum = 0;
        try {
            const row = db.prepare("SELECT SUM(estimated_saving_kwh) as total FROM bms_actions WHERE status = 'EXECUTED'").get();
            if (row && row.total) savedKwhSum = row.total;
        } catch (e) {}

        const carbonTons = (savedKwhSum * 0.00082).toFixed(2);
        const carbonPreventedStr = savedKwhSum > 0 ? `${carbonTons} Tons CO2e` : '0.00 Tons CO2e';

        // 3. Dynamic Water Conserved (Volume recovered from leak resolutions)
        let waterSavedLiters = 0;
        try {
            const wRow = db.prepare("SELECT SUM(current_value - baseline_value) as total FROM alerts WHERE resource_type = 'Water' AND status = 'RESOLVED'").get();
            if (wRow && wRow.total && wRow.total > 0) {
                waterSavedLiters = Math.round(wRow.total * 30);
            }
        } catch (e) {}
        const waterConservedStr = waterSavedLiters > 0 ? `${waterSavedLiters.toLocaleString()} Liters` : '0 Liters';

        // 4. Dynamic Potential Savings across all locations
        const savingsObj = calculateTotalPotentialSavings(facilityId);
        const potSavings = savingsObj.totalPotentialSavings;
        const potSavingsStr = `Rs. ${potSavings.toLocaleString()}`;

        res.json({
            period,
            facilityId,
            efficiencyScore: `${effScore} / 100`,
            efficiencyScoreNum: effScore,
            carbonPrevented: carbonPreventedStr,
            waterConserved: waterConservedStr,
            potentialSavings: potSavingsStr,
            potentialSavingsNum: potSavings,
            energyReductionPercent: savedKwhSum > 0 ? `${((savedKwhSum / (totalCurrentElec || 1)) * 100).toFixed(1)}%` : '0.0%',
            resolvedAlertsCount: alertsResolved,
            recentBmsActions: bmsActions,
            hotspotsSummary: hotspots,
            summary: {
                efficiency_score: effScore,
                carbon_prevented: carbonPreventedStr,
                water_conserved: waterConservedStr,
                potential_savings: potSavings
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch reports', details: err.message });
    }
});

router.get('/export', (req, res) => {
    try {
        const format = req.query.format || 'json';
        const readings = db.prepare('SELECT * FROM resource_readings ORDER BY id DESC LIMIT 100').all();
        const hotspots = db.prepare('SELECT * FROM hotspots').all();
        const audit = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 50').all();

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="naxora_report.csv"');
            let csv = 'ID,Building,Room,ResourceType,CurrentValue,Baseline,DeviationPercent,Status,RecommendedAction\n';
            hotspots.forEach(h => {
                csv += `${h.id},"${h.building}","${h.room}","${h.resource_type}",${h.current_value},${h.baseline_value},${h.deviation_percent},"${h.status}","${h.recommended_action}"\n`;
            });
            return res.send(csv);
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="naxora_report.json"');
        res.json({ exportedAt: new Date().toISOString(), hotspots, readings, audit });
    } catch (err) {
        res.status(500).json({ error: 'Export failed', details: err.message });
    }
});

module.exports = router;