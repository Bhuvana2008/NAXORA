const { HotspotModel, AlertModel, SimulationEventModel, BmsActionModel, resetDatabase } = require('../models/dbModels');
const { evaluateAnomaly } = require('../services/anomalyService');

const simulatePowerSpike = (req, res) => {
    try {
        const spikeCurrent = 1846;
        const baseline = 620;
        const evalResult = evaluateAnomaly(spikeCurrent, baseline, 'Electricity');

        // 1. Update Block A hotspot
        const updatedHotspot = HotspotModel.update('block-a', {
            status: 'CRITICAL',
            waste_level: 'High',
            confidence: evalResult.confidence,
            current_consumption: spikeCurrent,
            deviation_percent: evalResult.deviationPercent,
            recommended_action: 'CRITICAL: Inspect high-consumption equipment and apply automated BMS shutdown.'
        });

        // 2. Create Alert
        const newAlert = AlertModel.add({
            location: 'Block A - Room 204',
            resource_type: 'Electricity',
            severity: 'CRITICAL',
            message: `Severe electrical power spike detected: ${spikeCurrent} kWh (+${evalResult.deviationPercent}% vs baseline). Automated BMS shutdown ready.`,
            timestamp: new Date().toISOString(),
            resolved: 0
        });

        // 3. Record simulation event
        SimulationEventModel.add({
            event_type: 'POWER_SPIKE_SIMULATION',
            location: 'Block A - Room 204',
            impact: `Electricity consumption surged to ${spikeCurrent} kWh (+${evalResult.deviationPercent}%)`
        });

        res.json({
            success: true,
            message: 'AI detected abnormal electricity consumption in Block A - Room 204.',
            event: 'POWER_SPIKE',
            hotspot: updatedHotspot,
            alert: newAlert,
            evaluation: evalResult
        });
    } catch (err) {
        res.status(500).json({ error: 'Simulation failed', details: err.message });
    }
};

const simulateWaterLeak = (req, res) => {
    try {
        const leakFlow = 940;
        const baseline = 310;
        const evalResult = evaluateAnomaly(leakFlow, baseline, 'Water');

        // Update Canteen / Plumbing line
        const updatedHotspot = HotspotModel.update('canteen', {
            status: 'HIGH',
            waste_level: 'High',
            confidence: evalResult.confidence,
            current_consumption: leakFlow,
            deviation_percent: evalResult.deviationPercent,
            recommended_action: 'Isolate secondary supply valve #03 and inspect main wash seal.'
        });

        const newAlert = AlertModel.add({
            location: 'Canteen - Main Plumbing Line',
            resource_type: 'Water',
            severity: 'HIGH',
            message: `Abnormal continuous water flow detected: ${leakFlow} L/hr (+${evalResult.deviationPercent}%). Potential pipe fracture identified.`,
            timestamp: new Date().toISOString(),
            resolved: 0
        });

        SimulationEventModel.add({
            event_type: 'WATER_LEAK_SIMULATION',
            location: 'Canteen Plumbing Line',
            impact: `Water flow surged to ${leakFlow} L/hr (+${evalResult.deviationPercent}%)`
        });

        res.json({
            success: true,
            message: 'AI detected abnormal water consumption. Possible leakage identified.',
            event: 'WATER_LEAK',
            hotspot: updatedHotspot,
            alert: newAlert,
            evaluation: evalResult
        });
    } catch (err) {
        res.status(500).json({ error: 'Water leak simulation failed', details: err.message });
    }
};

const applyBmsShutdown = (req, res) => {
    try {
        const energySaved = 360; // kWh saved
        const costSaved = 2880; // Rs saved

        // Normalize Block A
        const updatedHotspot = HotspotModel.update('block-a', {
            status: 'NORMAL',
            waste_level: 'Low',
            confidence: 96,
            current_consumption: 580,
            deviation_percent: -6.4,
            recommended_action: 'BMS automated shutdown executed. Load successfully throttled to nominal baseline.'
        });

        // Log BMS Action
        const bmsAction = BmsActionModel.add({
            location: 'Block A - Room 204',
            action: 'Automated BMS Power Cutoff & Idle Sub-circuit Isolation',
            energy_saved: energySaved,
            cost_saved: costSaved
        });

        res.json({
            success: true,
            title: 'BMS Shutdown Command Simulated Successfully',
            simulationLabel: 'Active Simulation',
            location: 'Block A - Room 204',
            energySavedKwh: energySaved,
            costSavedRs: costSaved,
            message: `Automated BMS shutdown applied. Successfully saved ${energySaved} kWh and estimated Rs. ${costSaved.toLocaleString()}.`,
            hotspot: updatedHotspot,
            action: bmsAction
        });
    } catch (err) {
        res.status(500).json({ error: 'BMS shutdown execution failed', details: err.message });
    }
};

const resetBaselineData = (req, res) => {
    try {
        const restoredData = resetDatabase();
        res.json({
            success: true,
            message: 'Original baseline KPI values, hotspots, alerts, and predictions restored successfully.',
            data: restoredData
        });
    } catch (err) {
        res.status(500).json({ error: 'Reset failed', details: err.message });
    }
};

module.exports = {
    simulatePowerSpike,
    simulateWaterLeak,
    applyBmsShutdown,
    resetBaselineData
};