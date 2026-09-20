const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
    try {
        const facilities = db.prepare('SELECT * FROM facilities').all();
        res.json({ count: facilities.length, facilities });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch facilities', details: err.message });
    }
});

module.exports = router;