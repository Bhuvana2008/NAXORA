/**
 * ==========================================================================
 * NAXORA STEP 3 VERIFICATION TEST SUITE
 * AI Anomaly Detection, Configurable Thresholds, Explainability, Dynamic Confidence,
 * Deduplicated Alerts & State Synchronization
 * ==========================================================================
 */

const http = require('http');
const assert = require('assert');
const { ANOMALY_THRESHOLDS, calculateConfidence, evaluateAnomaly } = require('./server/services/anomalyEngine');

const BASE_URL = 'http://127.0.0.1:5000/api';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, headers: res.headers, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, headers: res.headers, body: data });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
}

async function runStep3Tests() {
    console.log('\n==================================================');
    console.log('NAXORA STEP 3 TEST SUITE: AI ANOMALY & ALERT ENGINE');
    console.log('==================================================\n');

    let passed = 0;
    let failed = 0;

    function test(name, fn) {
        return Promise.resolve()
            .then(fn)
            .then(() => {
                console.log(`  [PASS] ${name}`);
                passed++;
            })
            .catch(err => {
                console.error(`  [FAIL] ${name}`);
                console.error(`         Error: ${err.message}`);
                failed++;
            });
    }

    // 1. Unit Tests for Anomaly Engine
    console.log('>>> 1. Configurable Severity Thresholds & Unit Logic');

    await test('ANOMALY_THRESHOLDS object is defined and configurable', () => {
        assert.strictEqual(typeof ANOMALY_THRESHOLDS, 'object');
        assert.strictEqual(ANOMALY_THRESHOLDS.NORMAL_MAX, 20.0);
        assert.strictEqual(ANOMALY_THRESHOLDS.MEDIUM_MAX, 50.0);
        assert.strictEqual(ANOMALY_THRESHOLDS.HIGH_MAX, 100.0);
    });

    await test('Severity Classifications match specified thresholds', () => {
        const normal = evaluateAnomaly(110, 100, 'Electricity', 0, false, 5, 'Zone A', 'kWh');
        assert.strictEqual(normal.severity, 'NORMAL', '10% deviation should be NORMAL (<20%)');

        const medium = evaluateAnomaly(135, 100, 'Electricity', 0, false, 5, 'Zone A', 'kWh');
        assert.strictEqual(medium.severity, 'MEDIUM', '35% deviation should be MEDIUM (20-50%)');

        const high = evaluateAnomaly(175, 100, 'Electricity', 0, false, 5, 'Zone A', 'kWh');
        assert.strictEqual(high.severity, 'HIGH', '75% deviation should be HIGH (50-100%)');

        const critical = evaluateAnomaly(220, 100, 'Electricity', 0, false, 5, 'Zone A', 'kWh');
        assert.strictEqual(critical.severity, 'CRITICAL', '120% deviation should be CRITICAL (>100%)');
    });

    await test('Dynamic Confidence Score & Low Confidence Baseline Learning', () => {
        const learningConf = calculateConfidence(1, 40, true);
        assert.strictEqual(learningConf.isLowConfidence, true);
        assert.strictEqual(learningConf.label, 'Low confidence — baseline learning');
        assert.ok(learningConf.score < 70, 'Learning confidence must be < 70');

        const stableConf = calculateConfidence(6, 120, false);
        assert.strictEqual(stableConf.isLowConfidence, false);
        assert.ok(stableConf.score >= 80, 'Stabilized confidence with 6 samples & high deviation must be >= 80');
        assert.notStrictEqual(stableConf.score, 96, 'Confidence should not be hardcoded to 96%');
    });

    await test('5-Point Explainable AI Answers generation without baseless claims', () => {
        const emptyRoomCrit = evaluateAnomaly(1486, 620, 'Electricity', 0, false, 5, 'Block A - Room 204', 'kWh');
        assert.ok(emptyRoomCrit.what.includes('Electricity consumption anomaly'));
        assert.strictEqual(emptyRoomCrit.where, 'Block A - Room 204');
        assert.strictEqual(emptyRoomCrit.howSevere, 'CRITICAL');
        assert.ok(emptyRoomCrit.why.includes('occupancy is zero'), 'Reason must explain zero occupancy');
        assert.ok(emptyRoomCrit.action.includes('automated BMS shutdown') || emptyRoomCrit.action.includes('Inspect room'));
        assert.ok(emptyRoomCrit.explanation.length > 50);

        const occupiedWater = evaluateAnomaly(240, 45, 'Water', 15, false, 5, 'Canteen', 'L');
        assert.strictEqual(occupiedWater.howSevere, 'CRITICAL');
        assert.ok(occupiedWater.why.includes('liquid flow') || occupiedWater.why.includes('pipe') || occupiedWater.why.includes('valve'));
    });

    // 2. Integration / API Tests
    console.log('\n>>> 2. Server API Ingestion, Alert Engine & Synchronization Tests');

    // Reset database baseline
    await test('POST /api/reset resets system to nominal baseline state', async () => {
        const res = await request('POST', '/reset', { facility_id: 'campus' });
        assert.strictEqual(res.status, 200);
    });

    // TEST CASE 1: Block A - Room 204 (1486 kWh, Occ 0)
    console.log('\n>>> 3. TEST CASE 1: Block A - Room 204 (1486 kWh, Occ 0)');

    let testCase1AlertId = null;

    await test('Ingest Telemetry for Block A - Room 204 (1486 kWh, Occ 0)', async () => {
        const res = await request('POST', '/telemetry', {
            location: 'Block A - Room 204',
            resourceType: 'electricity',
            value: 1486,
            unit: 'kWh',
            occupancy: 0,
            facility: 'campus',
            source: 'MANUAL_INPUT'
        });

        assert.ok(res.status === 200 || res.status === 201, `Status should be 200 or 201, got ${res.status}`);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.diagnostic.severity, 'CRITICAL');
        assert.strictEqual(res.body.diagnostic.deviationPercent, 139.7);
        assert.strictEqual(res.body.baseline, 620);
        assert.ok(res.body.alert, 'Alert must be generated');
        assert.strictEqual(res.body.alert.severity, 'CRITICAL');
        assert.strictEqual(res.body.alert.status, 'ACTIVE');
        testCase1AlertId = res.body.alert.id;
    });

    await test('Verify Alerts Center contains active Block A - Room 204 alert with full schema', async () => {
        const res = await request('GET', '/alerts?status=ACTIVE');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.activeCount >= 1);
        
        const blkAlert = res.body.alerts.find(a => a.location.includes('Block A'));
        assert.ok(blkAlert, 'Active alert for Block A must exist in alerts');
        assert.strictEqual(blkAlert.severity, 'CRITICAL');
        assert.strictEqual(blkAlert.resourceType, 'Electricity');
        assert.strictEqual(blkAlert.currentValue, 1486);
        assert.strictEqual(blkAlert.baseline, 620);
        assert.strictEqual(blkAlert.status, 'ACTIVE');
    });

    await test('Verify Dashboard reflects increased Active Alerts & Critical status', async () => {
        const res = await request('GET', '/dashboard?facility_id=campus');
        assert.strictEqual(res.status, 200);
        assert.ok(res.body.kpis.activeAlerts.value >= 1);
        assert.strictEqual(res.body.kpis.electricity.status, 'CRITICAL');
        assert.strictEqual(res.body.aiInsight.severity, 'CRITICAL');
        assert.ok(res.body.aiInsight.reason.includes('zero') || res.body.aiInsight.reason.includes('occupancy'));
    });

    await test('Verify Audit Trail recorded event: "Anomaly detected"', async () => {
        const res = await request('GET', '/audit');
        assert.strictEqual(res.status, 200);
        const anomalyLog = res.body.logs.find(l => (l.action === 'Anomaly detected' || l.action.includes('Anomaly')) && l.location === 'Block A - Room 204');
        assert.ok(anomalyLog, 'Audit log must contain event "Anomaly detected" for Block A - Room 204');
        assert.strictEqual(anomalyLog.location, 'Block A - Room 204');
        assert.strictEqual(anomalyLog.status, 'CRITICAL');
    });

    await test('Resolve Block A alert via POST /api/alerts/:id/resolve and verify nominal synchronization', async () => {
        assert.ok(testCase1AlertId, 'Alert ID must be present');
        const res = await request('POST', `/alerts/${testCase1AlertId}/resolve`);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.body.success, true);

        // Verify Hotspot returned to NORMAL
        const hotspotsRes = await request('GET', '/hotspots?facility_id=campus');
        const blkHotspot = hotspotsRes.body.hotspots.find(h => h.id === 'block-a');
        assert.strictEqual(blkHotspot.status, 'NORMAL');
        assert.strictEqual(blkHotspot.severity, 'NORMAL');

        // Verify Audit Trail recorded "Alert Resolved"
        const auditRes = await request('GET', '/audit');
        const resolveLog = auditRes.body.logs.find(l => l.action === 'Alert Resolved');
        assert.ok(resolveLog, 'Audit trail must record "Alert Resolved"');
        assert.strictEqual(resolveLog.status, 'RESOLVED');
    });

    // TEST CASE 2: Block B - Room 105 (900 kWh) - Independent Baseline Test
    console.log('\n>>> 4. TEST CASE 2: Block B - Room 105 (900 kWh) - Independent Baseline');

    await test('Ingest Block B - Room 105 (900 kWh) & verify Block B baseline (400 kWh) is used, NOT 620 kWh', async () => {
        const res = await request('POST', '/telemetry', {
            location: 'Block B - Room 105',
            resourceType: 'electricity',
            value: 900,
            unit: 'kWh',
            occupancy: 20,
            facility: 'campus',
            source: 'MANUAL_INPUT'
        });

        assert.ok(res.status === 200 || res.status === 201, `Status should be 200 or 201, got ${res.status}`);
        assert.strictEqual(res.body.baseline, 400, 'Must use Block B baseline (400 kWh), NOT Room 204 (620 kWh)');
        assert.strictEqual(res.body.diagnostic.deviationPercent, 125.0, '((900-400)/400)*100 = 125.0%');
        assert.strictEqual(res.body.diagnostic.severity, 'CRITICAL');
        assert.strictEqual(res.body.hotspot.id, 'block-b');
        assert.ok(res.body.alert, 'Alert created for Block B');
        assert.strictEqual(res.body.alert.location, 'Block B - Room 105');
    });

    await test('Alert Deduplication: Sending another reading for Block B updates alert without creating duplicates', async () => {
        const countBeforeRes = await request('GET', '/alerts?status=ACTIVE');
        const countBefore = countBeforeRes.body.alerts.filter(a => a.location.includes('Block B')).length;
        assert.strictEqual(countBefore, 1);

        const res = await request('POST', '/telemetry', {
            location: 'Block B - Room 105',
            resourceType: 'electricity',
            value: 950,
            unit: 'kWh',
            occupancy: 20,
            facility: 'campus',
            source: 'MANUAL_INPUT'
        });

        assert.ok(res.status === 200 || res.status === 201, `Status should be 200 or 201, got ${res.status}`);
        assert.strictEqual(res.body.alert.isNew, false, 'Alert must be updated, not duplicated');

        const countAfterRes = await request('GET', '/alerts?status=ACTIVE');
        const countAfter = countAfterRes.body.alerts.filter(a => a.location.includes('Block B')).length;
        assert.strictEqual(countAfter, 1, 'Active alerts count for Block B must remain exactly 1');
    });

    console.log('\n==================================================');
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

// Execute tests
runStep3Tests().catch(err => {
    console.error('Fatal test execution error:', err);
    process.exit(1);
});
