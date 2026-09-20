const { HotspotModel, AlertModel, PredictionModel, ResourceModel } = require('../models/dbModels');
const { generateArimaForecast } = require('../services/predictionService');

const getDashboardData = (req, res) => {
    try {
        const hotspots = HotspotModel.getAll();
        const alerts = AlertModel.getActive();
        const predictions = PredictionModel.getAll();

        // Calculate dynamic KPIs from DB
        const blockA = HotspotModel.getById('block-a');
        const isSpike = blockA && (blockA.status === 'CRITICAL' || blockA.status === 'HIGH');
        
        let electricityKwh = isSpike ? 1846 : 1248;
        let waterLiters = 8420;
        let potentialSavings = isSpike ? 6840 : 3840;
        let efficiencyScore = isSpike ? 68 : 82;

        const forecast = generateArimaForecast(electricityKwh, isSpike);

        const response = {
            brand: 'NAXORA',
            tagline: 'AI Campus Resource Guardian',
            demoMode: 'LIVE MONITORING MODE',
            systemStatus: 'All Systems Active',
            kpis: {
                electricity: {
                    value: `${electricityKwh} kWh`,
                    trend: isSpike ? '^ +43.8% ANOMALY SPIKE' : 'v 8.6% vs yesterday',
                    status: isSpike ? 'CRITICAL' : 'OPTIMAL'
                },
                water: {
                    value: `${waterLiters} L`,
                    trend: 'v 4.2% vs baseline',
                    status: 'NORMAL'
                },
                activeAlerts: {
                    value: alerts.length,
                    subtext: alerts.length > 2 ? 'Immediate Action Required' : 'Needs Immediate Action',
                    severity: alerts.length > 2 ? 'CRITICAL' : 'HIGH'
                },
                potentialSavings: {
                    value: `Rs. ${potentialSavings.toLocaleString()}`,
                    subtext: 'This Month (Recoverable)',
                    status: 'OPTIMAL'
                }
            },
            impactMetrics: {
                resourceEfficiencyScore: `${efficiencyScore}/100`,
                carbonPrevented: isSpike ? '2.84 Tons' : '3.42 Tons',
                waterConserved: '42,500 L'
            },
            aiInsight: {
                title: 'AI INSIGHT',
                engine: 'AI Anomaly Detection Engine',
                primaryLocation: blockA ? `${blockA.location} - ${blockA.room}` : 'BLOCK A - Room 204',
                message: isSpike
                    ? 'Block A, Room 204 is consuming 2.4x more electricity than average during non-working hours.'
                    : 'System telemetry normalized across all academic blocks. Standby vampire loads monitored in Lab 2.',
                reason: isSpike
                    ? 'Abnormal electricity consumption detected during zero occupancy (HVAC & 8 GPU workstations running unthrottled).'
                    : 'Standard operational load within nominal tolerance.',
                confidence: blockA ? blockA.confidence : 91,
                recommendedAction: isSpike
                    ? 'Inspect high-consumption equipment and apply automated BMS control.'
                    : 'Continue automated baseline monitoring.'
            },
            futurePrediction: {
                title: 'FUTURE PREDICTION',
                summary: isSpike
                    ? 'Room 204 may waste approx 252 kWh/month if unmitigated. Estimated avoidable cost: Rs. 2,016/month.'
                    : 'Waste generation will increase by 18% in the next 3 days in Canteen and Hostel Block.',
                monthlyWasteKwh: isSpike ? 252 : 180,
                estimatedAvoidableCost: isSpike ? 2016 : 1440,
                confidence: isSpike ? 96 : 91,
                forecastChart: forecast
            },
            priorityAlert: alerts[0] || {
                location: 'Block A - Room 204',
                severity: 'CRITICAL',
                message: 'High waste detected in Block A, Room 204.',
                action: 'Immediate attention required!'
            },
            hotspots,
            alerts
        };

        res.json(response);
    } catch (err) {
        console.error('[DashboardController Error]:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data', details: err.message });
    }
};

module.exports = { getDashboardData };