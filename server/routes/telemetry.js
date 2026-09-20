const express = require('express');
const router = express.Router();
const db = require('../database');
const { processTelemetryInput, registerSseClient, unregisterSseClient } = require('../services/telemetryEngine');

// POST /api/telemetry (ESP32 & Simulator Ingestion)
router.post('/', (req, res) => {
    try {
        const result = processTelemetryInput(req.body);
        res.status(201).json(result);
    } catch (err) {
        res.status(400).json({
            success: false,
            error: 'Telemetry ingestion failed',
            message: err.message
        });
    }
});

// GET /api/telemetry/stream (Real-Time Server-Sent Events)
router.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders();

    registerSseClient(res);

    // Send initial handshake
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Telemetry Stream Connected to NAXORA Engine' })}\n\n`);

    req.on('close', () => {
        unregisterSseClient(res);
    });
});

// GET /api/telemetry/latest (Latest Sensor Readings by Zone)
router.get('/latest', (req, res) => {
    try {
        const latestReadings = db.prepare(`
            SELECT r.*, d.status as device_status
            FROM resource_readings r
            LEFT JOIN iot_devices d ON r.device_id = d.device_id
            WHERE r.id IN (
                SELECT MAX(id) FROM resource_readings GROUP BY building_id, resource_type
            )
            ORDER BY r.id DESC
        `).all();

        res.json({ count: latestReadings.length, readings: latestReadings });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch latest readings', details: err.message });
    }
});

// GET /api/telemetry/resource-readings (Historical Feed)
router.get('/resource-readings', (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 50;
        const readings = db.prepare('SELECT * FROM resource_readings ORDER BY id DESC LIMIT ?').all(limit);
        res.json({ count: readings.length, readings });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch readings', details: err.message });
    }
});

module.exports = router;