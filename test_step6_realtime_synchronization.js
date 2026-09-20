/**
 * ==========================================================================
 * NAXORA STEP 6 COMPREHENSIVE VERIFICATION TEST SUITE
 * Real-Time Monitoring & Automatic State Synchronization
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

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passedTests++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failedTests++;
    }
}

async function runStep6Tests() {
    console.log('==================================================');
    console.log('NAXORA STEP 6 TEST SUITE: REAL-TIME MONITORING & SYNC');
    console.log('==================================================\n');

    // 1. Reset baseline
    const resetRes = await request('POST', '/reset', { facility_id: 'campus' });
    assert(resetRes.status === 200, 'POST /api/reset resets database to nominal baseline');

    // 2. Health check endpoint (for status indicator)
    const healthRes = await request('GET', '/health');
    assert(healthRes.status === 200 && healthRes.body.status.toLowerCase() === 'ok', 'GET /api/health responds with 200 OK');

    // 3. Central backend API endpoints verification
    console.log('\n>>> 1. Testing Central API Endpoints (All 7 Endpoints)');
    const dashRes = await request('GET', '/dashboard?facility_id=campus');
    assert(dashRes.status === 200 && Array.isArray(dashRes.body.hotspots), 'GET /api/dashboard returns live dashboard data');
    assert(Array.isArray(dashRes.body.hotspots), 'Dashboard contains hotspots array');

    const resRes = await request('GET', '/resources?facility_id=campus');
    assert(resRes.status === 200 && Array.isArray(resRes.body.resources), 'GET /api/resources returns resources list');

    const alertsRes = await request('GET', '/alerts?facility_id=campus');
    assert(alertsRes.status === 200 && Array.isArray(alertsRes.body.alerts), 'GET /api/alerts returns alerts list');

    const insightsRes = await request('GET', '/insights?facility_id=campus');
    assert(insightsRes.status === 200 && insightsRes.body.success, 'GET /api/insights returns AI insights');

    const predsRes = await request('GET', '/predictions?facility_id=campus');
    assert(predsRes.status === 200 && predsRes.body.success, 'GET /api/predictions returns forecast data');

    const savingsRes = await request('GET', '/savings?facility_id=campus');
    assert(savingsRes.status === 200 && savingsRes.body.success, 'GET /api/savings returns dynamic savings');

    const auditRes = await request('GET', '/audit?facility_id=campus');
    assert(auditRes.status === 200 && Array.isArray(auditRes.body.logs), 'GET /api/audit returns audit records');

    // 4. Real-time Telemetry Processing and Instant State Synchronization
    console.log('\n>>> 2. Testing Instant State Synchronization on Ingestion');
    const telPayload = {
        location: 'Block A - Room 204',
        resourceType: 'electricity',
        value: 1486,
        unit: 'kWh',
        occupancy: 0,
        facility: 'campus',
        source: 'STEP6_TEST'
    };
    const telRes = await request('POST', '/telemetry', telPayload);
    assert((telRes.status === 200 || telRes.status === 201) && telRes.body.diagnostic && telRes.body.diagnostic.severity === 'CRITICAL', 'POST /api/telemetry detected CRITICAL anomaly');

    // Fetch dashboard immediately
    const dashSync = await request('GET', '/dashboard?facility_id=campus');
    const blockAHotspot = dashSync.body.hotspots.find(h => h.id === 'block-a');
    assert(blockAHotspot && blockAHotspot.current_value === 1486, 'Dashboard hotspot immediately synchronized to 1486 kWh');
    assert(blockAHotspot && blockAHotspot.severity === 'CRITICAL', 'Dashboard hotspot severity immediately CRITICAL');
    assert(dashSync.body.kpis.activeAlerts.value >= 1 || dashSync.body.alerts.length >= 1, 'Active alert count immediately updated in dashboard state');

    // Fetch alerts immediately
    const alertsSync = await request('GET', '/alerts?facility_id=campus');
    const activeAlert = alertsSync.body.alerts.find(a => a.location.includes('Block A') && a.status === 'ACTIVE');
    assert(activeAlert !== undefined, 'Alerts endpoint immediately returns active alert for Block A');

    // Fetch audit immediately
    const auditSync = await request('GET', '/audit?facility_id=campus');
    const latestAudit = auditSync.body.logs[0];
    assert(latestAudit && latestAudit.location.includes('Block A'), 'Audit trail immediately captures ingestion event');

    // 5. Test Multi-Location Isolation & Synchronization
    console.log('\n>>> 3. Testing Dynamic Location Isolation & Multi-Zone Sync');
    const b105Payload = {
        location: 'Block B - Room 105',
        resourceType: 'electricity',
        value: 900,
        unit: 'kWh',
        occupancy: 10,
        facility: 'campus',
        source: 'STEP6_TEST'
    };
    await request('POST', '/telemetry', b105Payload);

    const multiDash = await request('GET', '/dashboard?facility_id=campus');
    const blockB = multiDash.body.hotspots.find(h => h.id === 'block-b');
    assert(blockB && blockB.current_value === 900, 'Block B hotspot synchronized to 900 kWh');
    const blockACheck = multiDash.body.hotspots.find(h => h.id === 'block-a');
    assert(blockACheck && blockACheck.current_value === 1486, 'Block A remains 1486 kWh and isolated from Block B');

    // 6. Test BMS Action Real-Time Synchronization
    console.log('\n>>> 4. Testing BMS Action Execution & State Synchronization');
    const bmsRes = await request('POST', '/actions/bms-shutdown', {
        facility_id: 'campus',
        location: 'Block A - Room 204'
    });
    assert(bmsRes.status === 200 && bmsRes.body.success, 'POST /api/actions/bms-shutdown executed successfully');

    const postBmsDash = await request('GET', '/dashboard?facility_id=campus');
    const blockAPostBms = postBmsDash.body.hotspots.find(h => h.id === 'block-a');
    assert(blockAPostBms && blockAPostBms.severity === 'NORMAL', 'Block A hotspot immediately returned to NORMAL after BMS action');

    const postBmsAlerts = await request('GET', '/alerts?facility_id=campus');
    const resolvedAlert = postBmsAlerts.body.alerts.find(a => a.location.includes('Block A') && a.status === 'RESOLVED');
    assert(resolvedAlert !== undefined, 'Block A alert immediately transitioned to RESOLVED');

    // 7. Verify Frontend Implementation Files
    console.log('\n>>> 5. Testing Frontend Code Structure & Elements');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(indexHtml.includes('id="livePillBadge"'), 'index.html contains livePillBadge');
    assert(indexHtml.includes('id="liveStatusPillTxt"'), 'index.html contains liveStatusPillTxt');
    assert(indexHtml.includes('id="lastUpdatedContainer"'), 'index.html contains lastUpdatedContainer');
    assert(indexHtml.includes('id="lastUpdatedTime"'), 'index.html contains lastUpdatedTime');

    const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
    assert(scriptJs.includes('async function refreshNaxoraState('), 'script.js defines central refreshNaxoraState()');
    assert(scriptJs.includes('function startAutoRefresh('), 'script.js defines startAutoRefresh()');
    assert(scriptJs.includes('5000'), 'script.js uses 5000ms default auto-refresh interval');
    assert(scriptJs.includes('function updateSystemStatusIndicator('), 'script.js defines updateSystemStatusIndicator()');
    assert(scriptJs.includes('function updateLastUpdatedTimestamp('), 'script.js defines updateLastUpdatedTimestamp()');
    assert(scriptJs.includes('function syncOpenModals('), 'script.js defines in-place syncOpenModals()');
    assert(scriptJs.includes('isRefreshingNaxora'), 'script.js implements request lock to prevent race conditions');

    const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
    assert(styleCss.includes('.live-pill-badge'), 'style.css styles .live-pill-badge');
    assert(styleCss.includes('.live-pill-badge.offline'), 'style.css styles .live-pill-badge.offline');
    assert(styleCss.includes('.last-updated-pill'), 'style.css styles .last-updated-pill');

    console.log('\n==================================================');
    console.log(`STEP 6 TEST SUMMARY: ${passedTests} Passed, ${failedTests} Failed`);
    console.log('==================================================');

    if (failedTests > 0) {
        process.exit(1);
    }
}

runStep6Tests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
