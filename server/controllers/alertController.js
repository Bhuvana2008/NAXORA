const { AlertModel } = require('../models/dbModels');

const getAlerts = (req, res) => {
    try {
        const alerts = AlertModel.getAll();
        res.json({ total: alerts.length, activeCount: alerts.filter(a => !a.resolved).length, alerts });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch alerts', details: err.message });
    }
};

module.exports = { getAlerts };