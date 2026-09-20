const express = require('express');
const router = express.Router();

const { getDashboardData } = require('../controllers/dashboardController');
const { getHotspots, getHotspotById } = require('../controllers/hotspotController');
const { getAlerts } = require('../controllers/alertController');
const { simulatePowerSpike, simulateWaterLeak, applyBmsShutdown, resetBaselineData } = require('../controllers/simulationController');
const { ResourceModel, PredictionModel } = require('../models/dbModels');

// Health Check
router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'NAXORA backend',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Dashboard & Hotspots
router.get('/dashboard', getDashboardData);
router.get('/hotspots', getHotspots);
router.get('/hotspots/:id', getHotspotById);

// Insights, Predictions & Alerts
router.get('/insights', (req, res) => {
    const dashboard = require('../controllers/dashboardController');
    dashboard.getDashboardData(req, res);
});
router.get('/predictions', (req, res) => {
    res.json({ predictions: PredictionModel.getAll() });
});
router.get('/alerts', getAlerts);
router.get('/resource-readings', (req, res) => {
    res.json({ readings: ResourceModel.getAll() });
});

// Simulation Endpoints
router.post('/simulate/power-spike', simulatePowerSpike);
router.post('/simulate/water-leak', simulateWaterLeak);
router.post('/bms/shutdown', applyBmsShutdown);
router.post('/reset', resetBaselineData);

module.exports = router;