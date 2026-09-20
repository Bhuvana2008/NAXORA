const { HotspotModel } = require('../models/dbModels');
const { evaluateAnomaly } = require('../services/anomalyService');

const getHotspots = (req, res) => {
    try {
        const hotspots = HotspotModel.getAll();
        res.json({ count: hotspots.length, hotspots });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hotspots', details: err.message });
    }
};

const getHotspotById = (req, res) => {
    try {
        const hotspot = HotspotModel.getById(req.params.id);
        if (!hotspot) {
            return res.status(404).json({ error: 'Hotspot not found' });
        }
        const diagnostic = evaluateAnomaly(hotspot.current_consumption, hotspot.baseline_consumption, hotspot.resource_type);
        res.json({ hotspot, diagnostic });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch hotspot', details: err.message });
    }
};

module.exports = { getHotspots, getHotspotById };