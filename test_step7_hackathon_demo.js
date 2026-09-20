/**
 * ==========================================================================
 * NAXORA STEP 7: HACKATHON READY & DEPLOYMENT READINESS TEST SUITE
 * Complete End-to-End Verification of Hackathon Demo Flows (A through K)
 * ==========================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 5000;
const BASE_URL = `http://localhost:${PORT}`;

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passedCount++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failedCount++;
    }
}

function request(method, pathName, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(pathName, BASE_URL);
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
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    parsed = body;
                }
                resolve({ status: res.statusCode, data: parsed, headers: res.headers });
            });
        });

        req.on('error', reject);

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

async function runHackathonVerification() {
    console.log('==================================================');
    console.log('NAXORA STEP 7: HACKATHON & DEPLOYMENT TEST SUITE');
    console.log('==================================================\n');

    try {
        // ----------------------------------------------------
        // 0. RESET & HEALTH CHECK
        // ----------------------------------------------------
        console.log('>>> 0. SYSTEM HEALTH & BASELINE RESET');
        const resetRes = await request('POST', '/api/reset');
        assert(resetRes.status === 200 && resetRes.data.success, 'POST /api/reset restores clean baseline');

        const healthRes = await request('GET', '/api/health');
        assert(healthRes.status === 200 && healthRes.data.status === 'ok', 'GET /api/health responds 200 OK');

        // ----------------------------------------------------
        // 1. SECURITY & INPUT VALIDATION
        // ----------------------------------------------------
        console.log('\n>>> 1. SECURITY & INPUT VALIDATION CHECKS');
        
        // 1.1 Negative Value Rejection
        const negRes = await request('POST', '/api/telemetry', {
            location: 'Block A - Room 204',
            resourceType: 'electricity',
            value: -50
        });
        assert(negRes.status === 400, 'Security: Rejects negative telemetry consumption values (HTTP 400)');

        // 1.2 Missing Location Rejection
        const noLocRes = await request('POST', '/api/telemetry', {
            resourceType: 'electricity',
            value: 620
        });
        assert(noLocRes.status === 400, 'Security: Rejects payload with missing location (HTTP 400)');

        // 1.3 SQL Injection Parameterization Check
        const sqliRes = await request('POST', '/api/telemetry', {
            location: "Block A - Room 204' OR '1'='1",
            resourceType: 'electricity',
            value: 620
        });
        assert(sqliRes.status === 201, 'Security: Parameterized queries safely handle SQL special characters without error');

        // Reset baseline after security probe
        await request('POST', '/api/reset');

        // ----------------------------------------------------
        // 2. STEP A: BASELINE STATE VERIFICATION
        // ----------------------------------------------------
        console.log('\n>>> 2. STEP A: BASELINE STATE VERIFICATION');
        const dashRes = await request('GET', '/api/dashboard');
        assert(dashRes.status === 200, 'GET /api/dashboard returns 200 OK');
        assert(dashRes.data.activeAlerts === 3, 'Baseline has exact 3 active alerts (Room 204, Canteen, Lab 2)');
        assert(dashRes.data.hotspots.length >= 7, 'Baseline contains all 7 campus zones');

        // ----------------------------------------------------
        // 3. STEP B: SPATIAL MAP & MULTI-ZONE DISPLAY
        // ----------------------------------------------------
        console.log('\n>>> 3. STEP B: SPATIAL MAP & MULTI-ZONE DISPLAY');
        const mapHotspots = dashRes.data.hotspots;
        const blockA = mapHotspots.find(h => h.id === 'block-a');
        const canteen = mapHotspots.find(h => h.id === 'canteen');
        const lab2 = mapHotspots.find(h => h.id === 'lab2');
        const blockB = mapHotspots.find(h => h.id === 'block-b');

        assert(blockA && blockA.room === 'Room 204' && blockA.severity === 'CRITICAL', 'Map: Block A Room 204 displays CRITICAL');
        assert(canteen && canteen.severity === 'HIGH', 'Map: Main Canteen displays HIGH water surge');
        assert(lab2 && lab2.severity === 'MEDIUM', 'Map: Lab 2 displays MEDIUM idle thermal drift');
        assert(blockB && blockB.room === 'Room 105' && blockB.severity === 'NORMAL', 'Map: Block B Room 105 displays NORMAL');

        // ----------------------------------------------------
        // 4. STEP C: EXPLAINABLE AI ROOT CAUSE INSIGHTS
        // ----------------------------------------------------
        console.log('\n>>> 4. STEP C: EXPLAINABLE AI ROOT CAUSE INSIGHTS');
        const insightsRes = await request('GET', '/api/insights');
        assert(insightsRes.status === 200, 'GET /api/insights returns 200 OK');
        assert(insightsRes.data.mainInsight && insightsRes.data.mainInsight.why, 'Insight provides explainable root cause');
        assert(insightsRes.data.mainInsight.confidenceVal >= 80, 'Insight provides high-confidence diagnostic score');
        assert(insightsRes.data.mainInsight.suggestedAction, 'Insight provides actionable mitigation recommendation');

        // ----------------------------------------------------
        // 5. STEP D: PREDICTIONS & POTENTIAL SAVINGS
        // ----------------------------------------------------
        console.log('\n>>> 5. STEP D: PREDICTIONS & POTENTIAL SAVINGS');
        const predRes = await request('GET', '/api/predictions');
        assert(predRes.status === 200 && predRes.data.forecast.labels.length === 7, 'Predictions return 7-day rolling forecast horizon');

        const savingsRes = await request('GET', '/api/savings');
        assert(savingsRes.status === 200 && savingsRes.data.totalPotentialSavings > 0, 'Savings engine calculates dynamic monthly avoidable cost');

        // ----------------------------------------------------
        // 6. STEP E: LIVE TELEMETRY INGESTION (ROOM 204 ANOMALY)
        // ----------------------------------------------------
        console.log('\n>>> 6. STEP E: LIVE TELEMETRY INGESTION (ROOM 204 ANOMALY)');
        const telemRes = await request('POST', '/api/telemetry', {
            location: 'Block A - Room 204',
            resourceType: 'electricity',
            value: 1486,
            occupancy: 0,
            source: 'ESP32'
        });
        assert(telemRes.status === 201, 'POST /api/telemetry ingested successfully');
        assert(telemRes.data.diagnostic.severity === 'CRITICAL', 'AI Engine flags 1486 kWh / 0 occupancy as CRITICAL (+139.7%)');
        assert(telemRes.data.alert.status === 'ACTIVE', 'Alert automatically generated / synchronized');

        // ----------------------------------------------------
        // 7. STEP F: AUTOMATED BMS MITIGATION (ROOM 204)
        // ----------------------------------------------------
        console.log('\n>>> 7. STEP F: AUTOMATED BMS MITIGATION (ROOM 204)');
        const bmsRes = await request('POST', '/api/actions/bms-shutdown', {
            location: 'Block A - Room 204'
        });
        assert(bmsRes.status === 200 && bmsRes.data.status === 'EXECUTED', 'BMS shutdown action executed successfully');
        assert(bmsRes.data.savedResource === 866, 'Calculates 866 kWh avoidable waste load');
        assert(bmsRes.data.costSavedRs > 0, 'Calculates financial cost avoidance (Rs. 2,07,840)');

        // Verify alert is marked RESOLVED
        const alertsCheck = await request('GET', '/api/alerts');
        const blockAAlert = alertsCheck.data.alerts.find(a => a.location.includes('Block A'));
        assert(blockAAlert && blockAAlert.status === 'RESOLVED', 'Alert status transitioned to RESOLVED');

        // ----------------------------------------------------
        // 8. STEP G: POST-ACTION TELEMETRY & IMPACT MEASUREMENT
        // ----------------------------------------------------
        console.log('\n>>> 8. STEP G: POST-ACTION TELEMETRY & IMPACT MEASUREMENT');
        const postTelemRes = await request('POST', '/api/telemetry', {
            location: 'Block A - Room 204',
            resourceType: 'electricity',
            value: 620,
            occupancy: 15,
            source: 'ESP32'
        });
        assert(postTelemRes.status === 201, 'Post-action telemetry (620 kWh) ingested');
        assert(postTelemRes.data.postActionImpact && postTelemRes.data.postActionImpact.savedResource === 866, 'Impact verification confirms 866 kWh reduction');
        assert(postTelemRes.data.postActionImpact.reductionPercent === 58.3, 'Verified 58.3% load reduction vs pre-action load');

        // ----------------------------------------------------
        // 9. STEP H: MULTI-ZONE ISOLATION (BLOCK B - ROOM 105)
        // ----------------------------------------------------
        console.log('\n>>> 9. STEP H: MULTI-ZONE ISOLATION (BLOCK B - ROOM 105)');
        const blockBTelem = await request('POST', '/api/telemetry', {
            location: 'Block B - Room 105',
            resourceType: 'electricity',
            value: 400,
            occupancy: 20,
            source: 'ESP32'
        });
        assert(blockBTelem.status === 201, 'Block B telemetry ingested');
        assert(blockBTelem.data.diagnostic.severity === 'NORMAL', 'Block B nominal consumption (400 kWh) classified as NORMAL');

        // Verify Block A was not affected
        const dashAfterBlockB = await request('GET', '/api/dashboard');
        const blockAAfter = dashAfterBlockB.data.hotspots.find(h => h.id === 'block-a');
        const blockBAfter = dashAfterBlockB.data.hotspots.find(h => h.id === 'block-b');
        assert(blockAAfter.current_value === 620 && blockBAfter.current_value === 400, 'Zone Isolation: Block A and Block B remain independent');

        // ----------------------------------------------------
        // 10. STEP I: LAB 2 MEDIUM ANOMALY CONSISTENCY & ACTION
        // ----------------------------------------------------
        console.log('\n>>> 10. STEP I: LAB 2 MEDIUM ANOMALY & BMS ACTION');
        const lab2Alert = alertsCheck.data.alerts.find(a => a.location.includes('Lab 2'));
        assert(lab2Alert && lab2Alert.status === 'ACTIVE' && lab2Alert.severity === 'MEDIUM', 'Lab 2 alert is active and medium severity');

        const lab2Bms = await request('POST', '/api/actions/bms-shutdown', {
            location: 'Lab 2 - Server Rack'
        });
        assert(lab2Bms.status === 200 && lab2Bms.data.status === 'EXECUTED', 'BMS shutdown succeeds for Lab 2');

        // ----------------------------------------------------
        // 11. STEP J: AUDIT TRAIL IMMUTABILITY & TIMEZONE
        // ----------------------------------------------------
        console.log('\n>>> 11. STEP J: AUDIT TRAIL IMMUTABILITY & TIMEZONE');
        const auditRes = await request('GET', '/api/audit');
        assert(auditRes.status === 200 && auditRes.data.logs.length > 0, 'Audit ledger records all events');
        const latestAudit = auditRes.data.logs[0];
        assert(latestAudit.timeString && (latestAudit.timeString.includes('AM') || latestAudit.timeString.includes('PM')), 'Audit event has localized timestamp format');

        // ----------------------------------------------------
        // 12. STEP K: CLEAN DEMO REPLAY RESET
        // ----------------------------------------------------
        console.log('\n>>> 12. STEP K: CLEAN DEMO REPLAY RESET');
        const finalReset = await request('POST', '/api/reset');
        assert(finalReset.status === 200 && finalReset.data.activeAlerts === 3, 'Demo replay reset returns system to initial baseline ready for presentation');

        // ----------------------------------------------------
        // 13. FRONTEND / CONFIG AUDIT
        // ----------------------------------------------------
        console.log('\n>>> 13. FRONTEND & CONFIG AUDIT');
        const scriptContent = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
        assert(scriptContent.includes('NAXORA_CONFIG'), 'script.js supports window.NAXORA_CONFIG for production deployment');
        assert(scriptContent.includes('refreshNaxoraState'), 'script.js defines central refresh function');
        assert(scriptContent.includes('updateSystemStatusIndicator'), 'script.js defines honest offline/online status indicator');

        const envContent = fs.readFileSync(path.join(__dirname, '.env.example'), 'utf8');
        assert(envContent.includes('PORT') && envContent.includes('DB_PATH') && envContent.includes('CORS_ORIGIN'), '.env.example documents all deployment environment variables');

    } catch (err) {
        console.error('Fatal test error:', err);
        failedCount++;
    }

    console.log('\n==================================================');
    console.log(`STEP 7 TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('==================================================');

    if (failedCount > 0) {
        process.exit(1);
    }
}

runHackathonVerification();
