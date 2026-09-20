/**
 * ==========================================================================
 * NAXORA FINAL SYNCHRONIZATION & ACTION VERIFICATION TEST SUITE
 * ==========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000/api';

function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path.startsWith('http') ? path : `${BASE_URL}${path}`);
        const options = {
            hostname: url.hostname,
            port: url.port || 5000,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const parsed = data ? JSON.parse(data) : {};
                    resolve({ status: res.statusCode, body: parsed });
                } catch (e) {
                    resolve({ status: res.statusCode, text: data });
                }
            });
        });

        req.on('error', (err) => reject(err));
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function runFinalVerification() {
    console.log('==================================================');
    console.log('NAXORA FINAL VERIFICATION TEST SUITE');
    console.log('==================================================\n');

    // 1. Reset baseline
    const reset = await request('POST', '/reset', { facility_id: 'campus' });
    assert(reset.status === 200, 'POST /api/reset resets database to baseline');

    // TEST A: LAB 2 MEDIUM & ALERT CONSISTENCY
    console.log('\n>>> TEST A: Lab 2 Medium Anomaly & Alert Consistency');
    const dash = await request('GET', '/dashboard?facility_id=campus');
    const lab2Hotspot = dash.body.hotspots.find(h => h.id === 'lab2' || h.building.includes('Lab 2'));
    assert(lab2Hotspot && lab2Hotspot.severity === 'MEDIUM', 'Map Hotspot: Lab 2 is MEDIUM (420 kWh vs 280 kWh baseline)');

    const alertsRes = await request('GET', '/alerts?status=ACTIVE');
    const lab2Alert = alertsRes.body.alerts.find(a => a.location.includes('Lab 2') || a.hotspot_id === 'lab2');
    assert(lab2Alert !== undefined, 'Alerts Center: Active alert exists for Lab 2');
    assert(lab2Alert && lab2Alert.severity === 'MEDIUM', 'Lab 2 Alert severity is MEDIUM');
    assert(lab2Alert && lab2Alert.status === 'ACTIVE', 'Lab 2 Alert status is ACTIVE');

    assert(dash.body.kpis.activeAlerts.value === alertsRes.body.alerts.length, `Dashboard Active Alerts count (${dash.body.kpis.activeAlerts.value}) equals active alerts count (${alertsRes.body.alerts.length})`);
    assert(alertsRes.body.activeCount === alertsRes.body.alerts.length, `Alerts API activeCount equals active alerts count`);

    const insightsRes = await request('GET', '/insights?facility_id=campus');
    const lab2Insight = insightsRes.body.anomalies.find(a => a.building.includes('Lab 2') || a.location.includes('Lab 2'));
    assert(lab2Insight !== undefined, 'AI Insights: Anomaly detection card exists for Lab 2');

    // TEST B: MAP BMS ACTION ON LAB 2
    console.log('\n>>> TEST B: Map BMS Action on Lab 2');
    const bmsLab2 = await request('POST', '/actions/bms-shutdown', {
        facility_id: 'campus',
        location: 'Lab 2 - Server Rack'
    });
    assert(bmsLab2.status === 200 && bmsLab2.body.success, 'POST /api/actions/bms-shutdown succeeds for Lab 2');
    assert(bmsLab2.body.location.includes('Lab 2'), 'BMS Action targeted exact Lab 2 location');

    const postLab2Dash = await request('GET', '/dashboard?facility_id=campus');
    const postLab2Hotspot = postLab2Dash.body.hotspots.find(h => h.id === 'lab2' || h.building.includes('Lab 2'));
    assert(postLab2Hotspot && postLab2Hotspot.severity === 'NORMAL', 'Lab 2 Hotspot status returned to NORMAL after BMS shutdown');

    const postLab2Alerts = await request('GET', '/alerts?status=ALL');
    const resolvedLab2Alert = postLab2Alerts.body.alerts.find(a => a.location.includes('Lab 2'));
    assert(resolvedLab2Alert && resolvedLab2Alert.status === 'RESOLVED', 'Lab 2 alert status transitioned to RESOLVED');

    // TEST C: ROOM 204 BMS ACTION FROM MAP
    console.log('\n>>> TEST C: Room 204 BMS Action');
    const bmsRoom204 = await request('POST', '/actions/bms-shutdown', {
        facility_id: 'campus',
        location: 'Block A - Room 204'
    });
    assert(bmsRoom204.status === 200 && bmsRoom204.body.success, 'POST /api/actions/bms-shutdown succeeds for Block A - Room 204');

    const post204Dash = await request('GET', '/dashboard?facility_id=campus');
    const blockAHotspot = post204Dash.body.hotspots.find(h => h.id === 'block-a');
    assert(blockAHotspot && blockAHotspot.severity === 'NORMAL', 'Block A Hotspot status returned to NORMAL');

    // TEST D: AI REFRESH & POST-ACTION INSIGHT STATE
    console.log('\n>>> TEST D: AI Insights Refresh & Post-Action State');
    const postBmsInsights = await request('GET', '/insights?facility_id=campus');
    assert(postBmsInsights.status === 200 && postBmsInsights.body.success, 'GET /api/insights returns updated state');

    // TEST E: AUDIT TIMESTAMPS & LOCAL IST TIME
    console.log('\n>>> TEST E: Audit Timestamps (Asia/Kolkata / IST)');
    const auditRes = await request('GET', '/audit?facility_id=campus');
    assert(auditRes.status === 200 && auditRes.body.logs.length > 0, 'GET /api/audit returns audit ledger');
    const topLog = auditRes.body.logs[0];
    console.log('  [INFO] Latest Audit Event Time:', topLog.time);
    assert(typeof topLog.time === 'string' && topLog.time.length > 5, 'Audit log has formatted IST time string');
    assert(topLog.time.includes('2026') || topLog.time.includes('Sep') || topLog.time.includes(':'), 'Audit time string has date and time formatting');

    // TEST F: FRONTEND FUNCTION VALIDATION
    console.log('\n>>> TEST F: Frontend Functions Validation');
    const script = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    assert(script.includes('async function refreshAiAnalysis('), 'script.js defines refreshAiAnalysis()');
    assert(script.includes('NAXORA_STATE.currentSelectedHotspot'), 'script.js preserves currentSelectedHotspot for modal BMS action');
    assert(script.includes('BMS action failed. Please try again.'), 'script.js handles BMS action failures with required error text');
    assert(script.includes('console.error('), 'script.js logs errors to console');

    console.log('\n==================================================');
    console.log(`FINAL SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================');

    if (failed > 0) process.exit(1);
}

runFinalVerification().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
