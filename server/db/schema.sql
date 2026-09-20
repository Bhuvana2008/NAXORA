-- ==========================================================================
-- NAXORA DATABASE SCHEMA (SQLite)
-- ==========================================================================

CREATE TABLE IF NOT EXISTS facilities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    baseline_electricity REAL,
    baseline_water REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS buildings (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL,
    name TEXT NOT NULL,
    rooms_count INTEGER DEFAULT 1,
    FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    building_id TEXT NOT NULL,
    room_number TEXT NOT NULL,
    baseline_electricity REAL,
    baseline_water REAL,
    FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE TABLE IF NOT EXISTS resource_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_id TEXT NOT NULL,
    building_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    baseline_value REAL NOT NULL,
    occupancy INTEGER DEFAULT 0,
    source TEXT DEFAULT 'ESP32',
    device_id TEXT DEFAULT 'ESP32-01',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS iot_devices (
    device_id TEXT PRIMARY KEY,
    device_name TEXT NOT NULL,
    facility_id TEXT NOT NULL,
    building TEXT,
    room TEXT,
    sensors TEXT,
    status TEXT DEFAULT 'ONLINE',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    packets_today INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotspots (
    id TEXT PRIMARY KEY,
    facility_id TEXT NOT NULL,
    building TEXT NOT NULL,
    room TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    current_value REAL NOT NULL,
    baseline_value REAL NOT NULL,
    deviation_percent REAL NOT NULL,
    severity TEXT NOT NULL,
    confidence REAL NOT NULL,
    status TEXT NOT NULL,
    recommended_action TEXT NOT NULL,
    reason TEXT,
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotspot_id TEXT,
    severity TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    location TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    deviation_percent REAL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE / RESOLVED
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    facility_id TEXT NOT NULL,
    location TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    predicted_consumption REAL NOT NULL,
    prediction_period TEXT NOT NULL,
    confidence REAL NOT NULL,
    estimated_cost REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    observed_value REAL NOT NULL,
    baseline_value REAL NOT NULL,
    deviation_percent REAL NOT NULL,
    cause TEXT NOT NULL,
    confidence REAL NOT NULL,
    recommendation TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS simulation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    target_location TEXT NOT NULL,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bms_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hotspot_id TEXT,
    location TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'EXECUTED',
    estimated_saving_kwh REAL,
    estimated_saving_cost REAL,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    event TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);