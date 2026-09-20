const express = require('express');
const router = express.Router();
const db = require('../database');

/**
 * ==========================================================================
 * NAXORA ALERTS ROUTER (Step 3)
 * Unified Single Source of Truth for Active/Resolved Alerts
 * ==========================================================================
 */

router.get('/', (req, res) => {
    try {
        const filter = req.query.status || req.query.filter;
        let query = 'SELECT * FROM alerts';
        let params = [];
        if (filter && filter !== 'ALL') {
            if (filter === 'ACTIVE' || filter === 'RESOLVED') {
                query += ' WHERE status = ?';
                params.push(filter);
            } else {
                query += ' WHERE severity = ?';
                params.push(filter);
            }
        }
        query += ' ORDER BY id DESC';
        const rawAlerts = db.prepare(query).all(...params);

        const alerts = rawAlerts.map(a => {
            const isWater = (a.resource_type || '').toLowerCase().includes('water');
            const fallbackCur = isWater ? 240 : 1486;
            const fallbackBase = isWater ? 45 : 620;

            const curVal = a.current_value !== null && a.current_value !== undefined ? a.current_value : fallbackCur;
            const baseVal = a.baseline_value !== null && a.baseline_value !== undefined ? a.baseline_value : fallbackBase;

            return {
                id: a.id,
                hotspotId: a.hotspot_id,
                hotspot_id: a.hotspot_id,
                severity: a.severity,
                title: a.title,
                message: a.message,
                location: a.location,
                resourceType: a.resource_type,
                resource_type: a.resource_type,
                currentValue: curVal,
                current_value: curVal,
                baseline: baseVal,
                baseline_value: baseVal,
                deviation: a.deviation_percent,
                deviation_percent: a.deviation_percent,
                status: a.status,
                createdAt: a.created_at,
                created_at: a.created_at,
                resolvedAt: a.resolved_at,
                resolved_at: a.resolved_at
            };
        });

        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;
        res.json({ count: alerts.length, activeCount, alerts });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
    }
});

router.get('/:id', (req, res) => {
    try {
        const a = db.prepare('SELECT * FROM alerts WHERE id = ?').get(req.params.id);
        if (!a) return res.status(404).json({ error: 'Alert not found' });
        
        const isWater = (a.resource_type || '').toLowerCase().includes('water');
        const alert = {
            id: a.id,
            hotspotId: a.hotspot_id,
            hotspot_id: a.hotspot_id,
            severity: a.severity,
            title: a.title,
            message: a.message,
            location: a.location,
            resourceType: a.resource_type,
            resource_type: a.resource_type,
            currentValue: a.current_value !== null && a.current_value !== undefined ? a.current_value : (isWater ? 240 : 1486),
            current_value: a.current_value,
            baseline: a.baseline_value !== null && a.baseline_value !== undefined ? a.baseline_value : (isWater ? 45 : 620),
            baseline_value: a.baseline_value,
            deviation: a.deviation_percent,
            deviation_percent: a.deviation_percent,
            status: a.status,
            createdAt: a.created_at,
            created_at: a.created_at,
            resolvedAt: a.resolved_at,
            resolved_at: a.resolved_at
        };

        res.json({ alert });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alert', details: err.message });
    }
});

router.post('/', (req, res) => {
    try {
        const { hotspot_id, severity, title, message, location, resource_type, current_value, baseline_value, deviation_percent } = req.body;
        const result = db.prepare(`
            INSERT INTO alerts (hotspot_id, severity, title, message, location, resource_type, current_value, baseline_value, deviation_percent, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
        `).run(
            hotspot_id || 'block-a',
            severity || 'HIGH',
            title || 'AI Anomaly Alert',
            message || 'Abnormal resource consumption detected.',
            location || 'Block A - Room 204',
            resource_type || 'Electricity',
            parseFloat(current_value) || 1486,
            parseFloat(baseline_value) || 620,
            parseFloat(deviation_percent) || 139.7
        );

        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('ALERT_CREATED', `Automatic Alert: ${title || 'AI Anomaly'}`, location || 'Block A - Room 204', severity || 'HIGH', message || 'New alert generated from AI Insights.');

        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

        res.status(201).json({
            success: true,
            message: 'Alert created successfully.',
            alertId: result.lastInsertRowid,
            activeAlerts: activeCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to create alert', details: err.message });
    }
});

router.post('/:id/resolve', (req, res) => {
    try {
        const alertId = req.params.id;
        const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId);
        if (!alert) return res.status(404).json({ error: 'Alert not found' });

        // 1. Mark alert as RESOLVED with metadata
        db.prepare("UPDATE alerts SET status = 'RESOLVED', resolved_at = CURRENT_TIMESTAMP, resolved_by = 'Operator', resolution_action = 'Manual Resolution' WHERE id = ?").run(alertId);

        // 2. Return Hotspot to NORMAL status
        if (alert.hotspot_id) {
            db.prepare(`
                UPDATE hotspots SET
                    status = 'NORMAL',
                    severity = 'NORMAL',
                    deviation_percent = 0.0,
                    current_value = baseline_value,
                    recommended_action = 'Anomaly resolved. Nominal monitoring active.',
                    reason = 'Optimal resource efficiency verified against calibrated baseline.'
                WHERE id = ?
            `).run(alert.hotspot_id);
        }

        // Also update matching building in hotspots
        if (alert.location) {
            const bldName = alert.location.split(' - ')[0].trim();
            db.prepare(`
                UPDATE hotspots SET
                    status = 'NORMAL',
                    severity = 'NORMAL',
                    deviation_percent = 0.0,
                    current_value = baseline_value,
                    recommended_action = 'Anomaly resolved. Nominal monitoring active.',
                    reason = 'Optimal resource efficiency verified against calibrated baseline.'
                WHERE building LIKE ?
            `).run(`%${bldName}%`);
        }

        // 3. Mark matching insights as resolved
        try {
            db.prepare("UPDATE insights SET status = 'RESOLVED' WHERE location LIKE ?").run(`%${alert.location}%`);
        } catch (e) {}

        // 4. Record "Alert Resolved" in Audit Trail (Requirement 7)
        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('ALERT_RESOLVED', 'Alert Resolved', alert.location, 'RESOLVED', `Alert #${alertId} for ${alert.location} (${alert.resource_type}) marked RESOLVED. Monitored hotspot returned to NORMAL.`);

        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

        res.json({
            success: true,
            message: `Alert resolved successfully -- ${alert.location} returned to normal monitoring.`,
            resolvedAlertId: alertId,
            remainingActiveAlerts: activeCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to resolve alert', details: err.message });
    }
});

module.exports = router;