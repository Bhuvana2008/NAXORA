const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
    try {
        const rows = db.prepare('SELECT key, value FROM settings').all();
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json({ settings });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch settings', details: err.message });
    }
});

router.put('/', (req, res) => {
    try {
        const newSettings = req.body;
        const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
        
        for (const [key, val] of Object.entries(newSettings)) {
            updateStmt.run(key, String(val));
        }

        db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
            .run('SETTINGS_UPDATE', 'Application Settings Saved', 'System Config', 'SUCCESS', JSON.stringify(newSettings));

        res.json({ success: true, message: 'Settings saved successfully in database.' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to save settings', details: err.message });
    }
});

module.exports = router;