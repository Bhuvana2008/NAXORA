const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/resources - List all monitored resources, submeters & baseline states
router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || req.query.facility_id || 'campus';
        const hotspots = db.prepare('SELECT * FROM hotspots WHERE facility_id = ? ORDER BY id ASC').all(facilityId);
        
        const resources = hotspots.map(h => ({
            id: h.id,
            location: `${h.building} - ${h.room}`,
            building: h.building,
            room: h.room,
            resourceType: h.resource_type,
            resource_type: h.resource_type,
            value: h.current_value,
            current_value: h.current_value,
            baseline: h.baseline_value,
            baseline_value: h.baseline_value,
            deviationPercent: h.deviation_percent,
            deviation_percent: h.deviation_percent,
            unit: h.resource_type === 'Water' ? 'L' : (h.resource_type === 'Temperature' ? '°C' : (h.resource_type === 'Occupancy' ? 'people' : 'kWh')),
            severity: h.severity,
            status: h.status,
            confidence: h.confidence,
            recommendedAction: h.recommended_action,
            recommended_action: h.recommended_action,
            reason: h.reason,
            lastUpdated: h.detected_at || new Date().toISOString(),
            timestamp: h.detected_at || new Date().toISOString()
        }));

        res.json({ count: resources.length, resources });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch resources', details: err.message });
    }
});

// GET /api/resources/:id - Get specific monitored resource
router.get('/:id', (req, res) => {
    try {
        const h = db.prepare('SELECT * FROM hotspots WHERE id = ?').get(req.params.id);
        if (!h) return res.status(404).json({ error: 'Resource not found' });
        
        const resource = {
            id: h.id,
            location: `${h.building} - ${h.room}`,
            building: h.building,
            room: h.room,
            resourceType: h.resource_type,
            resource_type: h.resource_type,
            value: h.current_value,
            current_value: h.current_value,
            baseline: h.baseline_value,
            baseline_value: h.baseline_value,
            deviationPercent: h.deviation_percent,
            deviation_percent: h.deviation_percent,
            unit: h.resource_type === 'Water' ? 'L' : (h.resource_type === 'Temperature' ? '°C' : (h.resource_type === 'Occupancy' ? 'people' : 'kWh')),
            severity: h.severity,
            status: h.status,
            confidence: h.confidence,
            recommendedAction: h.recommended_action,
            reason: h.reason,
            lastUpdated: h.detected_at || new Date().toISOString(),
            timestamp: h.detected_at || new Date().toISOString()
        };

        res.json({ resource });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch resource', details: err.message });
    }
});

module.exports = router;
