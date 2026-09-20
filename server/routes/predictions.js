const express = require('express');
const router = express.Router();
const db = require('../database');
const { generatePredictionForecast, getLocationWisePredictions } = require('../services/predictionEngine');

/**
 * ==========================================================================
 * NAXORA PREDICTIONS ROUTER (Step 4)
 * Multi-Location 7-Day Rolling Horizon Forecast & Avoidable Waste Intelligence
 * ==========================================================================
 */

router.get('/', (req, res) => {
    try {
        const facilityId = req.query.facility || req.query.facility_id || 'campus';
        const targetLocation = req.query.location || null;
        
        const forecast = generatePredictionForecast(facilityId, targetLocation);
        const locationWisePredictions = getLocationWisePredictions(facilityId);

        const summary = {
            targetLocation: forecast.targetLocation,
            resourceType: forecast.resourceType,
            unit: forecast.unit,
            currentUsage: forecast.currentUsage,
            baselineUsage: forecast.baselineUsage,
            projected_wastage: forecast.projected_wastage,
            avoidable_cost: forecast.avoidable_cost,
            estimatedAvoidableCost: forecast.estimatedAvoidableCost,
            confidence: forecast.confidence,
            confidenceLabel: forecast.confidenceLabel,
            isLowConfidence: forecast.isLowConfidence,
            risk_level: forecast.risk_level,
            hasSufficientData: forecast.hasSufficientData,
            forecastPeriod: forecast.forecastPeriod,
            summary: forecast.summary
        };

        res.json({
            success: true,
            facilityId,
            forecast,
            summary,
            locationWisePredictions
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch predictions', details: err.message });
    }
});

module.exports = router;