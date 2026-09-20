-- NAXORA SQLite Database Schema & Seed Data

CREATE TABLE IF NOT EXISTS resource_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    consumption REAL NOT NULL,
    baseline REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hotspots (
    id TEXT PRIMARY KEY,
    location TEXT NOT NULL,
    room TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    status TEXT NOT NULL,
    waste_level TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    current_consumption REAL NOT NULL,
    baseline_consumption REAL NOT NULL,
    deviation_percent REAL NOT NULL,
    recommended_action TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    message TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    predicted_consumption REAL NOT NULL,
    prediction_period TEXT NOT NULL,
    confidence INTEGER NOT NULL,
    estimated_cost REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS simulation_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    location TEXT NOT NULL,
    impact TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bms_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    action TEXT NOT NULL,
    energy_saved REAL NOT NULL,
    cost_saved REAL NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);