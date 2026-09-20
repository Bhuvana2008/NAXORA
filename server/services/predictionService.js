const { generatePredictionForecast, getLocationWisePredictions, calculateTotalPotentialSavings } = require('./predictionEngine');

function generateArimaForecast(baseValue = 1248, isSpike = false) {
    const forecast = generatePredictionForecast('campus');
    return {
        title: forecast.title,
        labels: forecast.labels,
        baselineData: forecast.baseline,
        predictedData: forecast.actual_projected,
        confidence: forecast.confidence,
        period: forecast.forecastPeriod,
        summary: forecast.summary
    };
}

module.exports = {
    generateArimaForecast,
    generatePredictionForecast,
    getLocationWisePredictions,
    calculateTotalPotentialSavings
};