/**
 * ==========================================================================
 * NAXORA STEP 4 TEST SUITE: PREDICTIONS & POTENTIAL SAVINGS
 * ==========================================================================
 */

const BASE_URL = 'http://localhost:5000/api';

async function runStep4Tests() {
    console.log('==================================================');
    console.log('NAXORA STEP 4 TEST SUITE: PREDICTIONS & POTENTIAL SAVINGS');
    console.log('==================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, message, detail = '') {
        if (condition) {
            console.log(`  [PASS] ${message}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${message} - ${detail}`);
            failed++;
        }
    }

    try {
        // Reset DB to clean baseline state
        const resetRes = await fetch(`${BASE_URL}/reset`, { method: 'POST' });
        const resetData = await resetRes.json();
        assert(resetRes.ok && resetData.success, 'POST /api/reset restores clean baseline state');

        // 1. Test GET /api/predictions endpoint & schema
        console.log('\n>>> 1. Testing GET /api/predictions & 7-Day Rolling Horizon Forecast');
        const predRes = await fetch(`${BASE_URL}/predictions?facility=campus`);
        const predData = await predRes.json();
        assert(predRes.ok && predData.success, 'GET /api/predictions responds with success: true');
        assert(predData.forecast && Array.isArray(predData.forecast.labels), 'Forecast contains 7-day labels array');
        assert(predData.forecast.labels.length === 7, 'Forecast labels span exact 7-day rolling horizon');
        assert(Array.isArray(predData.forecast.baseline) && Array.isArray(predData.forecast.actual_projected), 'Forecast contains baseline and actual_projected series');
        assert(predData.forecast.method && !predData.forecast.method.includes('ARIMA'), 'Forecast accurately labeled without false ARIMA claims');
        assert(typeof predData.forecast.confidence === 'number' && predData.forecast.confidence > 0, 'Dynamic confidence score computed');
        assert(predData.summary && typeof predData.summary.avoidable_cost === 'number', 'Summary contains calculated avoidable cost');

        // 2. Test Location-Wise Predictions without Mixing
        console.log('\n>>> 2. Testing Location-Wise Isolated Predictions');
        assert(Array.isArray(predData.locationWisePredictions), 'locationWisePredictions array returned');
        
        const blockAPred = predData.locationWisePredictions.find(p => p.hotspotId === 'block-a' || p.location.includes('Block A'));
        assert(blockAPred !== undefined, 'Block A prediction generated independently');
        assert(blockAPred.currentUsage === 1486 && blockAPred.baselineUsage === 620, 'Block A prediction uses exact Block A telemetry (1486 kWh vs 620 kWh)');

        const canteenPred = predData.locationWisePredictions.find(p => p.hotspotId === 'canteen' || p.location.includes('Canteen'));
        assert(canteenPred !== undefined, 'Canteen prediction generated independently');
        assert(canteenPred.resourceType === 'Water' && canteenPred.currentUsage === 240, 'Canteen prediction uses exact Canteen water telemetry (240 L vs 45 L)');

        // 3. Test Dynamic Potential Savings API
        console.log('\n>>> 3. Testing GET /api/savings');
        const savRes = await fetch(`${BASE_URL}/savings?facility=campus`);
        const savData = await savRes.json();
        assert(savRes.ok && savData.success, 'GET /api/savings responds with success: true');
        assert(typeof savData.totalPotentialSavings === 'number' && savData.totalPotentialSavings > 0, `Total potential savings calculated dynamically: Rs. ${savData.totalPotentialSavings.toLocaleString()}`);
        assert(savData.costRates && savData.costRates.ELECTRICITY_PER_KWH === 8.0 && savData.costRates.WATER_PER_LITER === 0.08, 'Configured cost rates verified (Rs 8.0/kWh, Rs 0.08/L)');
        assert(Array.isArray(savData.locationBreakdown) && savData.locationBreakdown.length > 0, 'Location breakdown returned');

        // 4. Test Ingesting New Telemetry for Block B - Room 105 & Verifying Prediction Isolation
        console.log('\n>>> 4. Ingesting Telemetry for Block B - Room 105 (900 kWh) & Verifying Isolated Series');
        const telRes = await fetch(`${BASE_URL}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'Block B - Room 105',
                resourceType: 'Electricity',
                value: 900,
                unit: 'kWh',
                occupancy: 10,
                facility: 'campus',
                source: 'TEST_SUITE'
            })
        });
        const telData = await telRes.json();
        assert(telRes.ok && telData.success, 'Telemetry for Block B - Room 105 ingested');

        // Query predictions for Block B specifically
        const bPredRes = await fetch(`${BASE_URL}/predictions?facility=campus&location=Block%20B%20-%20Room%20105`);
        const bPredData = await bPredRes.json();
        assert(bPredData.forecast.targetLocation.includes('Block B'), `Forecast generated specifically for ${bPredData.forecast.targetLocation}`);
        assert(bPredData.forecast.currentUsage === 900 && bPredData.forecast.baselineUsage === 400, 'Block B forecast uses Block B baseline (400 kWh) and current (900 kWh), NOT Room 204');
        assert(bPredData.forecast.avoidable_cost > 0, `Block B avoidable cost calculated: Rs. ${bPredData.forecast.avoidable_cost.toLocaleString()}/mo`);

        // 5. Test Insufficient Historical Data Handling
        console.log('\n>>> 5. Testing Insufficient Data Handling for New Zone');
        const newZoneTel = await fetch(`${BASE_URL}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'New Research Annex - Zone 99',
                resourceType: 'Electricity',
                value: 350,
                unit: 'kWh',
                occupancy: 4,
                facility: 'campus',
                source: 'TEST_SUITE'
            })
        });
        const newZoneData = await newZoneTel.json();
        assert(newZoneData.diagnostic.isLearning, 'New zone correctly detected baseline learning mode');

        const newZonePredRes = await fetch(`${BASE_URL}/predictions?facility=campus&location=New%20Research%20Annex`);
        const newZonePredData = await newZonePredRes.json();
        assert(newZonePredData.forecast.hasSufficientData === false, 'New zone hasSufficientData is false');
        assert(newZonePredData.forecast.summary.includes('Insufficient historical data'), 'Summary shows "Insufficient historical data for reliable prediction."');

        // 6. Test Reports API Dynamic Calculations
        console.log('\n>>> 6. Testing GET /api/reports Dynamic Calculation');
        const repRes = await fetch(`${BASE_URL}/reports?facility=campus`);
        const repData = await repRes.json();
        assert(repRes.ok && repData.efficiencyScore, `Dynamic efficiency score: ${repData.efficiencyScore}`);
        assert(repData.potentialSavings && repData.potentialSavings.includes('Rs.'), `Dynamic potential savings in reports: ${repData.potentialSavings}`);

    } catch (err) {
        console.error('Test execution exception:', err);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`STEP 4 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runStep4Tests();
