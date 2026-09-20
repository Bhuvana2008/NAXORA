const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'naxora_data.json');

// Default Baseline Seed Data
const initialData = {
    resource_readings: [
        { id: 1, location: 'Campus Total', resource_type: 'Electricity', consumption: 1248, baseline: 1200, timestamp: new Date().toISOString() },
        { id: 2, location: 'Campus Total', resource_type: 'Water', consumption: 8420, baseline: 8200, timestamp: new Date().toISOString() },
        { id: 3, location: 'Block A', resource_type: 'Electricity', consumption: 1486, baseline: 620, timestamp: new Date().toISOString() },
        { id: 4, location: 'Lab 2', resource_type: 'Electricity', consumption: 340, baseline: 220, timestamp: new Date().toISOString() },
        { id: 5, location: 'Canteen', resource_type: 'Water', consumption: 420, baseline: 310, timestamp: new Date().toISOString() }
    ],
    hotspots: [
        {
            id: 'block-a',
            location: 'BLOCK A',
            room: 'Room 204',
            resource_type: 'Electricity',
            status: 'HIGH',
            waste_level: 'High',
            confidence: 96,
            current_consumption: 1486,
            baseline_consumption: 620,
            deviation_percent: 139,
            recommended_action: 'Inspect high-consumption equipment and apply automated BMS shutdown.',
            updated_at: new Date().toISOString()
        },
        {
            id: 'lab2',
            location: 'LAB 2',
            room: 'High Standby Power',
            resource_type: 'Electricity',
            status: 'MEDIUM',
            waste_level: 'Medium',
            confidence: 88,
            current_consumption: 340,
            baseline_consumption: 220,
            deviation_percent: 54,
            recommended_action: 'Enable automated sleep policy on computer lab sub-distribution board.',
            updated_at: new Date().toISOString()
        },
        {
            id: 'canteen',
            location: 'CANTEEN',
            room: 'Food & Water Waste',
            resource_type: 'Food/Water',
            status: 'MEDIUM',
            waste_level: 'Medium',
            confidence: 85,
            current_consumption: 420,
            baseline_consumption: 310,
            deviation_percent: 35,
            recommended_action: 'Calibrate washing valve regulators and track food preparation waste.',
            updated_at: new Date().toISOString()
        },
        {
            id: 'block-b',
            location: 'BLOCK B',
            room: 'Normal Usage',
            resource_type: 'Electricity',
            status: 'NORMAL',
            waste_level: 'Low',
            confidence: 95,
            current_consumption: 410,
            baseline_consumption: 400,
            deviation_percent: 2.5,
            recommended_action: 'Continue standard operating monitoring.',
            updated_at: new Date().toISOString()
        },
        {
            id: 'admin',
            location: 'ADMIN BLOCK',
            room: 'Normal Usage',
            resource_type: 'Electricity',
            status: 'NORMAL',
            waste_level: 'Low',
            confidence: 94,
            current_consumption: 310,
            baseline_consumption: 300,
            deviation_percent: 3.3,
            recommended_action: 'Continue standard operating monitoring.',
            updated_at: new Date().toISOString()
        },
        {
            id: 'hostel',
            location: 'HOSTEL BLOCK',
            room: 'Normal Usage',
            resource_type: 'Electricity/Water',
            status: 'NORMAL',
            waste_level: 'Low',
            confidence: 92,
            current_consumption: 520,
            baseline_consumption: 500,
            deviation_percent: 4.0,
            recommended_action: 'Continue standard operating monitoring.',
            updated_at: new Date().toISOString()
        },
        {
            id: 'library',
            location: 'LIBRARY',
            room: 'Low Waste',
            resource_type: 'Electricity',
            status: 'NORMAL',
            waste_level: 'Low',
            confidence: 97,
            current_consumption: 180,
            baseline_consumption: 190,
            deviation_percent: -5.2,
            recommended_action: 'Optimal energy efficiency verified.',
            updated_at: new Date().toISOString()
        }
    ],
    alerts: [
        {
            id: 1,
            location: 'Block A - Room 204',
            resource_type: 'Electricity',
            severity: 'CRITICAL',
            message: 'Severe abnormal electricity consumption detected (+139% above baseline). Immediate inspection recommended.',
            timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
            resolved: 0
        },
        {
            id: 2,
            location: 'Lab 2',
            resource_type: 'Electricity',
            severity: 'MEDIUM',
            message: 'Standby vampire power load elevated during idle period.',
            timestamp: new Date(Date.now() - 45 * 60000).toISOString(),
            resolved: 0
        }
    ],
    predictions: [
        {
            id: 1,
            location: 'Block A - Room 204',
            resource_type: 'Electricity',
            predicted_consumption: 252,
            prediction_period: 'Next 30 Days',
            confidence: 91,
            estimated_cost: 2016
        },
        {
            id: 2,
            location: 'Canteen & Hostel',
            resource_type: 'Resource Waste',
            predicted_consumption: 18,
            prediction_period: 'Next 3 Days (+18% Surge)',
            confidence: 86,
            estimated_cost: 1450
        }
    ],
    simulation_events: [],
    bms_actions: []
};

// In-Memory & Persistent JSON DB Manager
class DatabaseManager {
    constructor() {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.load();
    }

    load() {
        try {
            if (fs.existsSync(DB_FILE)) {
                const content = fs.readFileSync(DB_FILE, 'utf8');
                this.data = JSON.parse(content);
            } else {
                this.save();
            }
        } catch (err) {
            console.error('[DB] Error loading file, restoring baseline defaults:', err.message);
            this.data = JSON.parse(JSON.stringify(initialData));
            this.save();
        }
    }

    save() {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), 'utf8');
        } catch (err) {
            console.error('[DB] Error saving data file:', err.message);
        }
    }

    reset() {
        this.data = JSON.parse(JSON.stringify(initialData));
        this.save();
        return this.data;
    }

    get(table) {
        return this.data[table] || [];
    }

    insert(table, item) {
        if (!this.data[table]) this.data[table] = [];
        if (!item.id) {
            item.id = this.data[table].length > 0 ? Math.max(...this.data[table].map(i => typeof i.id === 'number' ? i.id : 0)) + 1 : 1;
        }
        item.timestamp = item.timestamp || new Date().toISOString();
        this.data[table].unshift(item);
        this.save();
        return item;
    }

    update(table, id, updates) {
        const list = this.data[table] || [];
        const index = list.findIndex(i => i.id === id);
        if (index !== -1) {
            this.data[table][index] = { ...this.data[table][index], ...updates, updated_at: new Date().toISOString() };
            this.save();
            return this.data[table][index];
        }
        return null;
    }
}

const db = new DatabaseManager();
module.exports = db;