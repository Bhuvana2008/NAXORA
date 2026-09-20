const express = require('express');
const router = express.Router();
const db = require('../database');

// GET /api/devices (List ESP32 nodes with online/offline status)
router.get('/', (req, res) => {
    try {
        let offlineTimeout = 30; // seconds
        try {
            const timeoutRow = db.prepare("SELECT value FROM settings WHERE key = 'offline_timeout'").get();
            if (timeoutRow) offlineTimeout = parseInt(timeoutRow.value, 10) || 30;
        } catch (e) {}

        const devices = db.prepare('SELECT * FROM iot_devices ORDER BY device_id ASC').all();
        const now = new Date();

        const calculatedDevices = devices.map(d => {
            let lastSeenStr = d.last_seen;
            if (lastSeenStr && !lastSeenStr.endsWith('Z')) {
                lastSeenStr = lastSeenStr.replace(' ', 'T') + 'Z';
            }
            const lastSeenTime = new Date(lastSeenStr);
            const diffSeconds = Math.round((now.getTime() - lastSeenTime.getTime()) / 1000);
            const isOnline = !isNaN(diffSeconds) && diffSeconds <= offlineTimeout;

            return {
                ...d,
                status: isOnline ? 'ONLINE' : 'OFFLINE',
                secondsAgo: Math.max(0, diffSeconds)
            };
        });

        const onlineCount = calculatedDevices.filter(d => d.status === 'ONLINE').length;

        res.json({
            count: calculatedDevices.length,
            onlineCount,
            offlineCount: calculatedDevices.length - onlineCount,
            devices: calculatedDevices
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch IoT devices', details: err.message });
    }
});

// POST /api/devices/register
router.post('/register', (req, res) => {
    try {
        const { device_id, device_name, facility_id, building, room, sensors } = req.body;
        if (!device_id) return res.status(400).json({ error: 'device_id is required' });

        db.prepare(`
            INSERT INTO iot_devices (device_id, device_name, facility_id, building, room, sensors, status)
            VALUES (?, ?, ?, ?, ?, ?, 'ONLINE')
            ON CONFLICT(device_id) DO UPDATE SET
                device_name = excluded.device_name,
                building = excluded.building,
                room = excluded.room,
                sensors = excluded.sensors,
                status = 'ONLINE',
                last_seen = CURRENT_TIMESTAMP
        `).run(device_id, device_name || `ESP32 Node (${building || 'Zone'})`, facility_id || 'campus', building || 'BLOCK A', room || 'Room 204', sensors || 'Electricity, Occupancy');

        res.status(201).json({ success: true, message: `Device ${device_id} registered successfully.` });
    } catch (err) {
        res.status(500).json({ error: 'Failed to register device', details: err.message });
    }
});

module.exports = router;