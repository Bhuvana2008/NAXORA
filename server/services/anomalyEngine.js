const db = require('../database');

/**
 * ==========================================================================
 * NAXORA AI ANOMALY DETECTION ENGINE (Step 3)
 * Configurable Thresholds, Explainable Diagnostics & Dynamic Confidence
 * ==========================================================================
 */

// Step 3 Configurable Thresholds Configuration Object
const ANOMALY_THRESHOLDS = {
    NORMAL_MAX: 20.0,    // deviation < 20%
    MEDIUM_MAX: 50.0,    // 20% <= deviation < 50%
    HIGH_MAX: 100.0,     // 50% <= deviation <= 100%
    CRITICAL_MIN: 100.0  // deviation > 100%
};

// Centralized Configurable Utility Cost Rates Configuration Object
const COST_RATES = {
    ELECTRICITY_PER_KWH: 8.0, // ₹ 8.00 / kWh
    WATER_PER_LITER: 0.08,     // ₹ 0.08 / L
    CO2_KG_PER_KWH: 0.82       // 0.82 kg CO2 per kWh = 0.00082 Metric Tons CO2e
};

/**
 * Dynamically calculates AI confidence score & human-readable confidence label
 * based on historical sample count, baseline stability, and deviation clarity.
 * 
 * @param {number} historyCount - Historical readings available for this zone
 * @param {number} deviationPercent - Percentage deviation from baseline
 * @param {boolean} isLearning - Whether baseline learning is active
 * @returns {{ score: number, label: string, isLowConfidence: boolean }}
 */
function calculateConfidence(historyCount = 0, deviationPercent = 0, isLearning = false) {
    if (isLearning || historyCount < 3) {
        const learnScore = Math.min(68, Math.max(50, 52 + (historyCount * 5)));
        return {
            score: learnScore,
            label: 'Low confidence — baseline learning',
            isLowConfidence: true
        };
    }

    // Calibrated baseline with 3+ historical samples
    let score = 78;

    // 1. Sample Size Bonus (up to +12%)
    const sampleBonus = Math.min(12, (historyCount - 2) * 2);
    score += sampleBonus;

    // 2. Deviation Clarity Bonus (distinct spikes are easier to classify)
    const absDev = Math.abs(deviationPercent);
    if (absDev >= 100) {
        score += 6; // Severe distinct outlier
    } else if (absDev >= 50) {
        score += 4; // Clear distinct anomaly
    } else if (absDev >= 20) {
        score += 2;
    }

    // Clamp score within realistic AI confidence envelope
    score = Math.min(98, Math.max(75, Math.round(score)));

    let label = 'High Confidence';
    if (score >= 90) {
        label = 'Very High Confidence';
    } else if (score >= 80) {
        label = 'High Confidence';
    } else {
        label = 'Medium Confidence';
    }

    return {
        score,
        label,
        isLowConfidence: false
    };
}

/**
 * Evaluates telemetry reading against calibrated baseline and generates 5-point Explainable AI Insights.
 * 
 * @param {number} current - Current resource telemetry value
 * @param {number} baseline - Calibrated normal baseline
 * @param {string} resourceType - Resource type (Electricity, Water, etc.)
 * @param {number} occupancy - Occupancy count (0 if unoccupied)
 * @param {boolean} isLearning - Baseline learning state
 * @param {number} historyCount - Historical sample count
 * @param {string} location - Formatted location string (e.g. "Block A - Room 204")
 * @param {string} unit - Measurement unit (kWh, L, etc.)
 * @returns {Object} Full diagnostic evaluation
 */
function evaluateAnomaly(
    current,
    baseline,
    resourceType = 'Electricity',
    occupancy = 0,
    isLearning = false,
    historyCount = 5,
    location = 'Campus Zone',
    unit = 'kWh'
) {
    const isWater = resourceType.toLowerCase().includes('water');
    const isTemp = resourceType.toLowerCase().includes('temp');
    const isOcc = resourceType.toLowerCase().includes('occup');

    // Handle initial baseline learning mode
    if (isLearning || !baseline || baseline <= 0) {
        const calibBase = (!baseline || baseline <= 0) ? current : baseline;
        const conf = calculateConfidence(historyCount, 0, true);
        const action = 'Telemetry recorded. Continuing continuous baseline calibration.';
        const why = 'Baseline learning in progress: Initial operating baseline calibrated for this zone.';

        return {
            current,
            baseline: calibBase,
            deviationPercent: 0.0,
            status: 'NORMAL',
            severity: 'NORMAL',
            confidence: conf.score,
            confidenceLabel: conf.label,
            isLowConfidence: conf.isLowConfidence,
            wasteLevel: 'Nominal',
            what: `Baseline calibration initialized for ${location} (${current} ${unit})`,
            where: location,
            howSevere: 'NORMAL',
            why,
            reason: why,
            action,
            recommendedAction: action,
            explanation: `${location} resource telemetry (${current} ${unit}) recorded. ${why} ${action}`,
            estimatedWaste: 0,
            estimatedAvoidableCost: 0,
            resourceType,
            isLearning: true
        };
    }

    // 1. Calculate Deviation Percentage
    const deviationPercent = Number((((current - baseline) / baseline) * 100).toFixed(1));

    // 2. Classify Severity via Configurable Thresholds
    let status = 'NORMAL';
    let severity = 'NORMAL';

    if (deviationPercent > ANOMALY_THRESHOLDS.HIGH_MAX) {
        status = 'CRITICAL';
        severity = 'CRITICAL';
    } else if (deviationPercent >= ANOMALY_THRESHOLDS.MEDIUM_MAX) {
        status = 'HIGH';
        severity = 'HIGH';
    } else if (deviationPercent >= ANOMALY_THRESHOLDS.NORMAL_MAX) {
        status = 'MEDIUM';
        severity = 'MEDIUM';
    } else {
        status = 'NORMAL';
        severity = 'NORMAL';
    }

    // 3. Dynamic Confidence Calculation
    const conf = calculateConfidence(historyCount, deviationPercent, isLearning);

    // 4. Generate 5-Point Explainable AI Answers (WHAT, WHERE, HOW SEVERE, WHY, WHAT SHOULD BE DONE)
    const what = `${resourceType} consumption anomaly (${current} ${unit} vs ${baseline} ${unit} baseline, ${deviationPercent > 0 ? '+' : ''}${deviationPercent}%)`;
    const where = location;
    const howSevere = severity;

    let why = 'Optimal resource efficiency verified against calibrated baseline.';
    let action = 'Maintain standard continuous baseline monitoring.';

    if (isWater) {
        if (severity === 'CRITICAL') {
            why = `Severe continuous liquid flow surge (${current} ${unit} vs ${baseline} ${unit} baseline, +${deviationPercent}%) indicating open valve, mainline rupture, or wash basin leak.`;
            action = 'Isolate main supply valve immediately and dispatch plumbing emergency response team.';
        } else if (severity === 'HIGH') {
            why = `Continuous wash basin valve leakage sustained +${deviationPercent}% above allowable threshold.`;
            action = 'Inspect wash line pressure regulator and replace worn gasket seal.';
        } else if (severity === 'MEDIUM') {
            why = `Elevated wash flow (+${deviationPercent}% above baseline) detected during prep hours or minor tap dripping.`;
            action = 'Check tap washers and verify flow meter calibration.';
        }
    } else if (isTemp) {
        if (severity === 'CRITICAL' || severity === 'HIGH') {
            why = `Server rack / ambient temperature (${current} ${unit}) exceeding calibrated safety envelope (+${deviationPercent}%).`;
            action = 'Activate auxiliary cooling and inspect thermal dissipation.';
        } else if (severity === 'MEDIUM') {
            why = `Minor ambient temperature elevation (+${deviationPercent}%).`;
            action = 'Check ventilation registers.';
        }
    } else {
        // Electricity / Power Telemetry
        if (occupancy === 0) {
            if (severity === 'CRITICAL') {
                why = `Electricity consumption (${current} ${unit}) is severely elevated (+${deviationPercent}% above baseline ${baseline} ${unit}) while occupancy is zero. High likelihood of unmonitored equipment or HVAC running unnecessarily in an empty zone.`;
                action = 'Inspect room immediately or apply automated BMS shutdown to isolate non-essential sub-circuits.';
            } else if (severity === 'HIGH') {
                why = `Elevated electrical draw (${current} ${unit}, +${deviationPercent}%) detected while room is unoccupied (occupancy = 0). Unattended equipment left active.`;
                action = 'Schedule immediate facility inspection and apply secondary circuit throttling.';
            } else if (severity === 'MEDIUM') {
                why = `Standby vampire power drain or unoptimized workstation sleep states (+${deviationPercent}%) in unoccupied room.`;
                action = 'Deploy automated sleep policy schedule across workstation banks.';
            }
        } else {
            if (severity === 'CRITICAL') {
                why = `Extreme electrical load surge (${current} ${unit}, +${deviationPercent}%) during active occupancy (${occupancy} occupants), exceeding normal operational baseline.`;
                action = 'Inspect equipment immediately and coordinate peak load distribution.';
            } else if (severity === 'HIGH') {
                why = `High continuous power consumption (${current} ${unit}, +${deviationPercent}%) exceeding calibrated baseline for ${occupancy} occupants.`;
                action = 'Schedule inspection and verify sub-circuit operational capacity.';
            } else if (severity === 'MEDIUM') {
                why = `Moderate electrical deviation (+${deviationPercent}%) above normal operational threshold with ${occupancy} occupants.`;
                action = 'Monitor sub-circuit load profile.';
            }
        }
    }

    // 5. Human-Readable Comprehensive Summary
    let explanation = '';
    if (severity === 'NORMAL') {
        explanation = `${location} ${resourceType.toLowerCase()} consumption (${current} ${unit}) is operating within calibrated nominal baseline parameters (${baseline} ${unit}). Recommended Action: ${action}`;
    } else {
        explanation = `${location} ${resourceType.toLowerCase()} consumption (${current} ${unit}) is ${deviationPercent > 0 ? '+' : ''}${deviationPercent}% above baseline (${baseline} ${unit}) ${occupancy === 0 ? 'while occupancy is zero' : `with ${occupancy} occupants`}. ${why} Recommended Action: ${action}`;
    }

    const estimatedWaste = Math.max(0, current - baseline);
    const unitCost = isWater ? COST_RATES.WATER_PER_LITER : COST_RATES.ELECTRICITY_PER_KWH;
    const estimatedAvoidableCost = Math.round(estimatedWaste * unitCost * 30);
    const wasteLevel = severity === 'CRITICAL' ? 'Critical' : (severity === 'HIGH' ? 'High' : (severity === 'MEDIUM' ? 'Medium' : 'Nominal'));

    return {
        current,
        baseline,
        deviationPercent,
        status,
        severity,
        confidence: conf.score,
        confidenceLabel: conf.label,
        isLowConfidence: conf.isLowConfidence,
        wasteLevel,
        what,
        where,
        howSevere,
        why,
        reason: why,
        action,
        recommendedAction: action,
        explanation,
        estimatedWaste,
        estimatedAvoidableCost,
        resourceType,
        isLearning: false
    };
}

module.exports = {
    ANOMALY_THRESHOLDS,
    COST_RATES,
    calculateConfidence,
    evaluateAnomaly
};