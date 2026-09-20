const db = require('../database/db');

const ResourceModel = {
    getAll: () => db.get('resource_readings'),
    add: (reading) => db.insert('resource_readings', reading)
};

const HotspotModel = {
    getAll: () => db.get('hotspots'),
    getById: (id) => db.get('hotspots').find(h => h.id === id),
    update: (id, data) => db.update('hotspots', id, data)
};

const AlertModel = {
    getAll: () => db.get('alerts'),
    getActive: () => db.get('alerts').filter(a => !a.resolved),
    add: (alert) => db.insert('alerts', alert),
    resolve: (id) => db.update('alerts', id, { resolved: 1 })
};

const PredictionModel = {
    getAll: () => db.get('predictions'),
    add: (pred) => db.insert('predictions', pred)
};

const SimulationEventModel = {
    getAll: () => db.get('simulation_events'),
    add: (evt) => db.insert('simulation_events', evt)
};

const BmsActionModel = {
    getAll: () => db.get('bms_actions'),
    add: (action) => db.insert('bms_actions', action)
};

module.exports = {
    ResourceModel,
    HotspotModel,
    AlertModel,
    PredictionModel,
    SimulationEventModel,
    BmsActionModel,
    resetDatabase: () => db.reset()
};