const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || 'campus';
        const hotspots = db.prepare('SELECT * FROM hotspots WHERE facility_id = ?').all(facilityId);
        res.json({ count: hotspots.length, hotspots });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hotspots', details: err.message });
    }
});

router.get('/:id', (req, res) => {
    try {
        const hotspot = db.prepare('SELECT * FROM hotspots WHERE id = ?').get(req.params.id);
        if (!hotspot) {
            return res.status(404).json({ error: 'Hotspot not found' });
        }
        res.json({ hotspot });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hotspot', details: err.message });
    }
});

module.exports = router;