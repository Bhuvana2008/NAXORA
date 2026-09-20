const express = require('express');
const router = express.Router();
const db = require('../database');

function formatISTAuditTime(rawTimestamp) {
    if (!rawTimestamp) return 'Just now';
    let d;
    if (typeof rawTimestamp === 'string') {
        let clean = rawTimestamp.trim();
        if (!clean.endsWith('Z') && !clean.includes('+') && clean.includes(' ')) {
            clean = clean.replace(' ', 'T') + 'Z';
        } else if (!clean.endsWith('Z') && !clean.includes('+') && !clean.includes('T')) {
            clean = clean + 'Z';
        }
        d = new Date(clean);
    } else {
        d = new Date(rawTimestamp);
    }
    if (isNaN(d.getTime())) d = new Date();

    const datePart = d.toLocaleDateString('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
    const timePart = d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    return `${datePart}, ${timePart}`;
}

router.get('/', (req, res) => {
    try {
        const category = req.query.category || 'ALL';
        const rawLogs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 150').all();

        const logs = rawLogs.map(log => {
            let actor = 'System';
            let cat = 'SYSTEM';
            const act = (log.action || '').toUpperCase();
            const evt = (log.event || '').toUpperCase();

            if (act.includes('AI') || act.includes('ANOMALY') || act.includes('TELEMETRY') || evt.includes('ANOMALY')) {
                actor = 'AI Engine';
                cat = 'AI';
            } else if (act.includes('BMS') || act.includes('SHUTDOWN') || evt.includes('BMS')) {
                actor = 'BMS Controller';
                cat = 'BMS';
            } else if (act.includes('ALERT') || evt.includes('ALERT')) {
                actor = 'Alert Subsystem';
                cat = 'ALERTS';
            } else if (act.includes('SIMULATION') || act.includes('SPIKE') || act.includes('WATER') || act.includes('USER') || act.includes('MANUAL') || act.includes('SETTINGS')) {
                actor = 'Admin / Operator';
                cat = 'USER ACTIONS';
            }

            const formattedTime = formatISTAuditTime(log.timestamp);
            return {
                id: log.id,
                time: formattedTime,
                timeString: formattedTime,
                timestamp: log.timestamp,
                actor,
                action: log.event || log.action,
                location: log.location || 'Campus Wide',
                status: log.status || 'SUCCESS',
                details: log.details || '',
                category: cat
            };
        });

        const filtered = (category !== 'ALL')
            ? logs.filter(l => l.category === category)
            : logs;

        res.json({ count: filtered.length, total: logs.length, logs: filtered });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit logs', details: err.message });
    }
});

module.exports = router;