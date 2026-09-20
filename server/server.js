require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const db = require('./database');

// Import modular routes
const dashboardRouter = require('./routes/dashboard');
const resourcesRouter = require('./routes/resources');
const facilitiesRouter = require('./routes/facilities');
const hotspotsRouter = require('./routes/hotspots');
const alertsRouter = require('./routes/alerts');
const insightsRouter = require('./routes/insights');
const predictionsRouter = require('./routes/predictions');
const reportsRouter = require('./routes/reports');
const settingsRouter = require('./routes/settings');
const telemetryRouter = require('./routes/telemetry');
const savingsRouter = require('./routes/savings');
const { router: simulationsRouter, handleBmsShutdown } = require('./routes/simulations');
const auditRouter = require('./routes/audit');
const systemRouter = require('./routes/system');

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(s => s.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request Logger
app.use((req, res, next) => {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Standardized REST API Endpoints
app.use('/api', systemRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/facilities', facilitiesRouter);
app.use('/api/hotspots', hotspotsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/predictions', predictionsRouter);
app.use('/api/savings', savingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/telemetry', telemetryRouter);
app.use('/api/audit', auditRouter);
app.use('/api/audit-logs', auditRouter);

app.use('/api/resource-readings', (req, res) => {
    try {
        const readings = db.prepare('SELECT * FROM resource_readings ORDER BY id DESC LIMIT 50').all();
        res.json({ count: readings.length, readings });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.use('/api/simulate', simulationsRouter);
app.post('/api/actions/bms-shutdown', handleBmsShutdown);
app.post('/api/bms/shutdown', handleBmsShutdown);
app.post('/api/bms-shutdown', handleBmsShutdown);

// Reset API - Restores SQLite baseline state
app.post('/api/reset', (req, res) => {
    try {
        db.seedCleanInitialData();
        const activeCount = db.prepare("SELECT COUNT(*) as count FROM alerts WHERE status = 'ACTIVE'").get().count;

        res.json({
            success: true,
            message: 'Baseline data and alerts restored successfully.',
            activeAlerts: activeCount
        });
    } catch (err) {
        res.status(500).json({ error: 'Reset failed', details: err.message });
    }
});

// Serve Client Static Files
const rootPath = path.join(__dirname, '..');
app.use(express.static(rootPath));

app.get('*', (req, res) => {
    res.sendFile(path.join(rootPath, 'index.html'));
});

// Error Handler
app.use((err, req, res, next) => {
    console.error('[Server Error]:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || 'An unexpected error occurred on the NAXORA backend.'
    });
});

app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  NAXORA - AI Campus Resource Guardian Backend`);
    console.log(`  REST API Server running at: http://localhost:${PORT}`);
    console.log(`=======================================================`);
});

module.exports = app;