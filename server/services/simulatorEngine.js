const { processTelemetryInput } = require('./telemetryEngine');
const db = require('../database');

let simulatorInterval = null;
let cycleCounter = 0;
let isSimulatorRunning = false;

// Monitored Campus Zones
const SIMULATED_NODES = [
    { building: 'BLOCK A', room: 'Room 204', resourceType: 'Electricity', baseline: 620, unit: 'kWh', deviceId: 'ESP32-01' },
    { building: 'CANTEEN', room: 'Washing Station', resourceType: 'Water', baseline: 310, unit: 'L', deviceId: 'ESP32-02' },
    { building: 'LAB 2', room: 'Workstations Bay', resourceType: 'Electricity', baseline: 220, unit: 'kWh', deviceId: 'ESP32-03' },
    { building: 'HOSTEL BLOCK', room: 'Living Quarters', resourceType: 'Electricity', baseline: 500, unit: 'kWh', deviceId: 'ESP32-04' },
    { building: 'BLOCK B', room: 'Lecture Halls', resourceType: 'Electricity', baseline: 400, unit: 'kWh', deviceId: 'ESP32-01' },
    { building: 'LIBRARY', room: 'Archive & Study Hall', resourceType: 'Electricity', baseline: 190, unit: 'kWh', deviceId: 'ESP32-03' }
];

function generateSimulatedPacket() {
    cycleCounter++;
    const nodeIndex = (cycleCounter - 1) % SIMULATED_NODES.length;
    const node = SIMULATED_NODES[nodeIndex];

    let value = node.baseline;
    let occupancy = Math.floor(Math.random() * 30);

    // Every 6 cycles, trigger an intentional realistic anomaly on Block A or Canteen
    const isAnomalyCycle = (cycleCounter % 6 === 0);

    if (isAnomalyCycle && node.building === 'BLOCK A') {
        // High power surge during zero occupancy
        value = Math.round(1450 + Math.random() * 180);
        occupancy = 0;
    } else if (isAnomalyCycle && node.building === 'CANTEEN') {
        // Water leak surge
        value = Math.round(840 + Math.random() * 160);
        occupancy = 2;
    } else {
        // Standard normal variation within +/- 4%
        const variation = (Math.random() * 0.08) - 0.04;
        value = Math.round(node.baseline * (1 + variation));
    }

    return {
        facility: 'ANITS Campus',
        building: node.building,
        room: node.room,
        resourceType: node.resourceType,
        value: value,
        unit: node.unit,
        occupancy: occupancy,
        deviceId: node.deviceId,
        source: 'SIMULATOR',
        timestamp: new Date().toISOString()
    };
}

function tickSimulator() {
    try {
        const packet = generateSimulatedPacket();
        processTelemetryInput(packet);
    } catch (err) {
        console.error('[Simulator Error]:', err.message);
    }
}

function startSimulator(intervalMs = 5000) {
    if (isSimulatorRunning) return;
    isSimulatorRunning = true;
    cycleCounter = 0;
    
    // Immediate initial tick
    tickSimulator();
    simulatorInterval = setInterval(tickSimulator, intervalMs);
    console.log(`[Simulator Engine] Auto sensor simulation started (Interval: ${intervalMs}ms)`);

    db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
        .run('SIMULATOR_STARTED', 'Demo Sensor Simulator Started', 'Campus Wide', 'SUCCESS', `Background sensor ticker active (${intervalMs / 1000}s interval)`);
}

function stopSimulator() {
    if (!isSimulatorRunning) return;
    if (simulatorInterval) {
        clearInterval(simulatorInterval);
        simulatorInterval = null;
    }
    isSimulatorRunning = false;
    console.log('[Simulator Engine] Auto sensor simulation stopped.');

    db.prepare("INSERT INTO audit_logs (action, event, location, status, details) VALUES (?, ?, ?, ?, ?)")
        .run('SIMULATOR_STOPPED', 'Demo Sensor Simulator Stopped', 'Campus Wide', 'NORMAL', 'Background sensor ticker paused');
}

function getSimulatorStatus() {
    return {
        isRunning: isSimulatorRunning,
        cycleCount: cycleCounter
    };
}

module.exports = {
    startSimulator,
    stopSimulator,
    getSimulatorStatus
};