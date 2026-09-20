/**
 * ==========================================================================
 * NAXORA DATABASE MANAGER (SQLite DatabaseSync - Built-in Node v24)
 * ==========================================================================
 */

const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH ? path.resolve(process.cwd(), process.env.DB_PATH) : path.join(__dirname, 'db', 'naxora.db');
const SCHEMA_PATH = path.join(__dirname, 'db', 'schema.sql');

if (!fs.existsSync(path.dirname(DB_PATH))) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

let db = null;

try {
    db = new DatabaseSync(DB_PATH);
    console.log('[DB] SQLite database initialized at:', DB_PATH);
    
    if (fs.existsSync(SCHEMA_PATH)) {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
        
        try { db.exec("ALTER TABLE resource_readings ADD COLUMN source TEXT DEFAULT 'ESP32'"); } catch (e) {}
        try { db.exec("ALTER TABLE resource_readings ADD COLUMN device_id TEXT DEFAULT 'ESP32-01'"); } catch (e) {}
        try { db.exec("ALTER TABLE alerts ADD COLUMN current_value REAL"); } catch (e) {}
        try { db.exec("ALTER TABLE alerts ADD COLUMN baseline_value REAL"); } catch (e) {}
        try { db.exec("ALTER TABLE alerts ADD COLUMN resolved_by TEXT"); } catch (e) {}
        try { db.exec("ALTER TABLE alerts ADD COLUMN resolution_action TEXT"); } catch (e) {}
        try { db.exec("ALTER TABLE bms_actions ADD COLUMN before_value REAL"); } catch (e) {}
        try { db.exec("ALTER TABLE bms_actions ADD COLUMN post_action_value REAL"); } catch (e) {}
        try { db.exec("ALTER TABLE bms_actions ADD COLUMN actual_saved REAL"); } catch (e) {}
        try { db.exec("ALTER TABLE bms_actions ADD COLUMN impact_status TEXT DEFAULT 'PENDING'"); } catch (e) {}
        
        console.log('[DB] Schema verified & tables loaded.');
    }
} catch (err) {
    console.error('[DB] SQLite initialization error:', err.message);
    throw err;
}

function seedCleanInitialData() {
    try {
        console.log('[DB] Seeding/Refreshing NAXORA realistic datasets...');

        // 1. Facilities
        const insertFacility = db.prepare('INSERT OR REPLACE INTO facilities (id, name, type, baseline_electricity, baseline_water) VALUES (?, ?, ?, ?, ?)');
        insertFacility.run('campus', 'ANITS Campus (Main)', 'Educational', 1200, 8200);
        insertFacility.run('hospital', 'ABC Healthcare Complex', 'Healthcare', 2400, 15000);
        insertFacility.run('apartments', 'Green Valley Residential', 'Residential', 950, 6800);
        insertFacility.run('factory', 'XYZ Industrial Plant', 'Industrial', 5200, 22000);
        insertFacility.run('smartcity', 'City Zone 04 Municipal', 'Smart City', 8400, 45000);

        // 2. Hotspots for Campus
        db.prepare("DELETE FROM hotspots").run();
        const insertHotspot = db.prepare(`
            INSERT OR REPLACE INTO hotspots (id, facility_id, building, room, resource_type, current_value, baseline_value, deviation_percent, severity, confidence, status, recommended_action, reason)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertHotspot.run('block-a', 'campus', 'Block A', 'Room 204', 'Electricity', 1486, 620, 139.7, 'CRITICAL', 96, 'CRITICAL', 'Apply automated BMS shutdown and inspect HVAC/GPU equipment.', 'HVAC and GPU equipment are continuing to draw power during non-occupancy hours.');
        insertHotspot.run('canteen', 'campus', 'Main Canteen', 'Wash Station', 'Water', 240, 45, 433.3, 'HIGH', 94, 'HIGH', 'Isolate wash valve #03 and inspect main pipe seal.', 'Continuous water flow surge exceeding wash basin baseline (12% water pressure drop detected).');
        insertHotspot.run('lab2', 'campus', 'Lab 2', 'Server Rack', 'Electricity', 420, 280, 50.0, 'MEDIUM', 89, 'MEDIUM', 'Optimize rack cooling distribution and enable dynamic CPU sleep states.', 'Thermal standby drift. Standby equipment idle power drain exceeding thermal threshold.');
        insertHotspot.run('hostel', 'campus', 'Hostel Block', 'Living Quarters', 'Electricity', 500, 500, 0.0, 'NORMAL', 92, 'NORMAL', 'Nominal monitoring.', 'Consumption within optimal range.');
        insertHotspot.run('library', 'campus', 'Library', 'Study Hall', 'Electricity', 180, 190, -5.2, 'NORMAL', 97, 'NORMAL', 'Optimal energy efficiency verified.', 'LED retrofit active.');
        insertHotspot.run('admin', 'campus', 'Admin Block', 'Offices', 'Electricity', 300, 300, 0.0, 'NORMAL', 94, 'NORMAL', 'Maintain standard daytime monitoring.', 'Nominal daytime distribution.');
        insertHotspot.run('block-b', 'campus', 'Block B', 'Room 105', 'Electricity', 400, 400, 0.0, 'NORMAL', 95, 'NORMAL', 'Maintain standard daytime monitoring.', 'Nominal daytime distribution.');

        // 3. Alerts
        db.prepare("DELETE FROM alerts").run();
        const insertAlert = db.prepare(`
            INSERT INTO alerts (hotspot_id, severity, title, message, location, resource_type, current_value, baseline_value, deviation_percent, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertAlert.run('block-a', 'CRITICAL', 'CRITICAL ELECTRICITY ANOMALY', 'Electricity consumption remains abnormally high (1,486 kWh vs 620 kWh normal) despite zero room occupancy.', 'Block A - Room 204', 'Electricity', 1486, 620, 139.7, 'ACTIVE');
        insertAlert.run('canteen', 'HIGH', 'Continuous Water Flow Anomaly', 'Continuous water flow surge exceeding wash basin baseline (240 L/h vs 45 L/h baseline, 12% pressure drop).', 'Canteen - Wash Station', 'Water', 240, 45, 433.3, 'ACTIVE');
        insertAlert.run('lab2', 'MEDIUM', 'MEDIUM ELECTRICITY ANOMALY', 'Thermal standby drift: Standby equipment idle power drain exceeding thermal threshold (420 kWh vs 280 kWh normal).', 'Lab 2 - Server Rack', 'Electricity', 420, 280, 50.0, 'ACTIVE');

        // 4. Initial Predictions
        db.prepare("DELETE FROM predictions").run();
        const insertPred = db.prepare(`
            INSERT INTO predictions (facility_id, location, resource_type, predicted_consumption, prediction_period, confidence, estimated_cost)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        insertPred.run('campus', 'Block A - Room 204', 'Electricity', 252, 'Next 30 Days', 91, 2016);
        insertPred.run('campus', 'Canteen - Wash Station', 'Water', 4800, 'Next 30 Days', 94, 384);
        insertPred.run('campus', 'Lab 2 - Server Rack', 'Electricity', 140, 'Next 30 Days', 89, 1120);

        // 4b. Initial Insights
        try {
            db.prepare("DELETE FROM insights").run();
            const insertInsight = db.prepare(`
                INSERT INTO insights (location, resource_type, observed_value, baseline_value, deviation_percent, cause, confidence, recommendation, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
            `);
            insertInsight.run('Block A - Room 204', 'Electricity', 1486, 620, 139.7, 'HVAC and GPU equipment are continuing to draw power during non-occupancy hours.', 96, 'Apply automated BMS shutdown and inspect HVAC/GPU equipment.');
            insertInsight.run('Canteen - Wash Station', 'Water', 240, 45, 433.3, 'Continuous water flow surge exceeding wash basin baseline (12% water pressure drop detected).', 94, 'Isolate wash valve #03 and inspect main pipe seal.');
            insertInsight.run('Lab 2 - Server Rack', 'Electricity', 420, 280, 50.0, 'Thermal standby drift. Standby equipment idle power drain exceeding thermal threshold.', 89, 'Optimize rack cooling distribution and enable dynamic CPU sleep states.');
        } catch (e) {}

        // 4c. Initial Resource Readings History
        try {
            db.prepare("DELETE FROM resource_readings").run();
            const insertReading = db.prepare(`
                INSERT INTO resource_readings (facility_id, building_id, room_id, resource_type, value, unit, baseline_value, occupancy, source, device_id, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))
            `);
            insertReading.run('campus', 'Block A', 'Room 204', 'Electricity', 620, 'kWh', 620, 18, 'BASELINE', 'CALIB-01', '-3 days');
            insertReading.run('campus', 'Block A', 'Room 204', 'Electricity', 640, 'kWh', 620, 15, 'BASELINE', 'CALIB-01', '-2 days');
            insertReading.run('campus', 'Block A', 'Room 204', 'Electricity', 710, 'kWh', 620, 12, 'BASELINE', 'CALIB-01', '-1 day');
            insertReading.run('campus', 'Block A', 'Room 204', 'Electricity', 1486, 'kWh', 620, 0, 'ESP32', 'ESP32-BLK-A', '-10 minutes');
            insertReading.run('campus', 'Block B', 'Room 105', 'Electricity', 400, 'kWh', 400, 20, 'BASELINE', 'CALIB-03', '-3 days');
            insertReading.run('campus', 'Block B', 'Room 105', 'Electricity', 400, 'kWh', 400, 18, 'BASELINE', 'CALIB-03', '-2 days');
            insertReading.run('campus', 'Canteen', 'Wash Station', 'Water', 45, 'L', 45, 25, 'BASELINE', 'CALIB-02', '-2 days');
            insertReading.run('campus', 'Canteen', 'Wash Station', 'Water', 240, 'L', 45, 12, 'ESP32', 'ESP32-CNT-01', '-25 minutes');
            insertReading.run('campus', 'Lab 2', 'Server Rack', 'Electricity', 280, 'kWh', 280, 10, 'BASELINE', 'CALIB-04', '-3 days');
            insertReading.run('campus', 'Lab 2', 'Server Rack', 'Electricity', 420, 'kWh', 280, 2, 'ESP32', 'ESP32-LAB-02', '-15 minutes');
        } catch (e) {}

        // 5. Initial IoT Devices
        db.prepare("DELETE FROM iot_devices").run();
        const insertDevice = db.prepare(`
            INSERT INTO iot_devices (device_id, device_name, facility_id, building, room, sensors, status, last_seen, packets_today)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        `);
        insertDevice.run('ESP32-BLK-A', 'ESP32 Room Power Submeter', 'campus', 'Block A', 'Room 204', 'Electricity', 'ONLINE', 4820);
        insertDevice.run('ESP32-CNT-01', 'ESP32 Flow & Pressure Sensor', 'campus', 'Canteen', 'Wash Station', 'Water', 'ONLINE', 4120);
        insertDevice.run('ESP32-LAB-02', 'ESP32 Server Rack Monitor', 'campus', 'Lab 2', 'Server Rack', 'Electricity', 'ONLINE', 3950);
        insertDevice.run('ESP32-HST-01', 'ESP32 Hostel Main Submeter', 'campus', 'Hostel Block', 'Living Quarters', 'Electricity/Water', 'ONLINE', 5100);
        insertDevice.run('ESP32-LIB-01', 'ESP32 Study Hall Submeter', 'campus', 'Library', 'Archive Hall', 'Electricity', 'ONLINE', 3700);
        insertDevice.run('ESP32-ADM-01', 'ESP32 Admin Block Panel', 'campus', 'Admin Block', 'Council', 'Electricity', 'ONLINE', 4200);
        insertDevice.run('ESP32-BLKB-01', 'ESP32 Lecture Halls Panel', 'campus', 'Block B', 'Lecture Halls', 'Electricity', 'ONLINE', 4380);
        insertDevice.run('ESP32-GW-01', 'NAXORA IoT Master Gateway', 'campus', 'Central Server', 'Server Room', 'System', 'ONLINE', 9800);

        // 6. Settings
        const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
        insertSetting.run('monitoring_zone', 'ANITS Campus (Main)');
        insertSetting.run('auto_refresh', 'true');
        insertSetting.run('refresh_interval', '5');
        insertSetting.run('telemetry_interval', '5');
        insertSetting.run('offline_timeout', '30');

        console.log('[DB] Datasets successfully initialized.');
    } catch (e) {
        console.error('[DB] Seed error:', e.message);
    }
}

seedCleanInitialData();

module.exports = db;
module.exports.seedCleanInitialData = seedCleanInitialData;
