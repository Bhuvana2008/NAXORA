const express = require('express');
const router = express.Router();
const { calculateTotalPotentialSavings } = require('../services/predictionEngine');
const { COST_RATES } = require('../services/anomalyEngine');

/**
 * ==========================================================================
 * NAXORA POTENTIAL SAVINGS API ROUTER (Step 4)
 * Dynamic Location-Wise Savings Calculation & Utility Cost Aggregator
 * ==========================================================================
 */

router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || req.query.facility_id || 'campus';
        const savingsData = calculateTotalPotentialSavings(facilityId);

        res.json({
            success: true,
            facilityId,
            period: 'Monthly (Recoverable)',
            currency: 'Rs.',
            totalPotentialSavings: savingsData.totalPotentialSavings,
            formattedSavings: `Rs. ${savingsData.totalPotentialSavings.toLocaleString()}`,
            costRates: COST_RATES,
            totalExcessElecKwh: savingsData.totalExcessElecKwh,
            totalExcessWaterL: savingsData.totalExcessWaterL,
            locationBreakdown: savingsData.locationBreakdown
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to calculate potential savings', details: err.message });
    }
});

module.exports = router;
