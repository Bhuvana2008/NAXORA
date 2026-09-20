const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'NAXORA backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

router.get('/system/status', (req, res) => {
    try {
        const hotspotCount = db.prepare('SELECT COUNT(*) as count FROM hotspots').get().count;
        const alertCount = db.prepare('SELECT COUNT(*) as count FROM alerts').get().count;
        const readingsCount = db.prepare('SELECT COUNT(*) as count FROM resource_readings').get().count;
        
        res.json({
            status: 'HEALTHY',
            database: 'SQLite DatabaseSync Active',
            records: { hotspots: hotspotCount, alerts: alertCount, readings: readingsCount },
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        res.status(500).json({ status: 'ERROR', details: err.message });
    }
});

module.exports = router;