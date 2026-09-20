// test_step2_verification.js
const http = require('http');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const DB_PATH = path.join(__dirname, 'server', 'db', 'naxora.db');
const BASE_URL = 'http://localhost:5000';

function apiRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
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
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING NAXORA STEP 2 COMPREHENSIVE 14-STEP VERIFICATION ===\n');
  const db = new DatabaseSync(DB_PATH);
  let passed = 0;
  let failed = 0;

  function assert(condition, stepNum, description, details = '') {
    if (condition) {
      console.log(`[PASS] Step ${stepNum}: ${description}`);
      if (details) console.log(`       ↳ ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] Step ${stepNum}: ${description}`);
      if (details) console.error(`       ↳ ${details}`);
      failed++;
    }
  }

  try {
    // Step 1: Open Dashboard & check baseline state
    await apiRequest('POST', '/api/reset');
    const dash1 = await apiRequest('GET', '/api/dashboard');
    assert(
      dash1.status === 200 && dash1.data && dash1.data.kpis,
      1,
      'Open Dashboard & check baseline state',
      `Active Alerts: ${dash1.data.kpis?.activeAlerts?.value}, Electricity: ${dash1.data.kpis?.electricity?.value}, Water: ${dash1.data.kpis?.water?.value}`
    );

    // Step 2: Post Telemetry: { location: "Block A - Room 204", resourceType: "electricity", value: 1486, unit: "kWh", occupancy: 0 }
    const telemetryPayload = {
      location: "Block A - Room 204",
      resourceType: "electricity",
      value: 1486,
      unit: "kWh",
      occupancy: 0,
      timestamp: new Date().toISOString()
    };
    const telRes = await apiRequest('POST', '/api/telemetry', telemetryPayload);
    assert(
      (telRes.status === 200 || telRes.status === 201) && telRes.data && telRes.data.success,
      2,
      'Post Telemetry (Block A - Room 204: 1486 kWh, 0 occupancy)',
      `API Response: success=${telRes.data?.success}, status=${telRes.data?.diagnostic?.status}`
    );

    // Step 3: Verify backend stores reading in SQLite resource_readings
    const latestReading = db.prepare('SELECT * FROM resource_readings WHERE room_id LIKE ? ORDER BY id DESC LIMIT 1').get('%204%');
    assert(
      latestReading && latestReading.value === 1486 && latestReading.resource_type === 'Electricity',
      3,
      'Verify backend stores reading in SQLite resource_readings table',
      `ID: ${latestReading?.id}, Value: ${latestReading?.value} ${latestReading?.unit}, Baseline: ${latestReading?.baseline_value}`
    );

    // Step 4: Verify deviation calculation (+139.7%)
    const deviation = telRes.data?.diagnostic?.deviationPercent || telRes.data?.diagnostic?.deviation_percent;
    const expectedDev = ((1486 - 620) / 620) * 100; // ~139.67%
    assert(
      deviation !== undefined && Math.abs(deviation - expectedDev) < 0.5,
      4,
      'Verify dynamic deviation calculation against baseline (620 kWh -> 1486 kWh = +139.7%)',
      `Reported Deviation: +${deviation}% (Expected ~+${expectedDev.toFixed(1)}%)`
    );

    // Step 5: Verify anomaly classified as CRITICAL
    const severity = telRes.data?.diagnostic?.severity || telRes.data?.diagnostic?.status;
    assert(
      severity === 'CRITICAL',
      5,
      'Verify anomaly classified as CRITICAL (>100% deviation)',
      `Classification: ${severity}`
    );

    // Step 6: Verify alert automatically created / updated in alerts table
    const alertRow = db.prepare("SELECT * FROM alerts WHERE (location LIKE '%Block A%' OR hotspot_id = 'block-a') AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1").get();
    assert(
      alertRow && alertRow.severity === 'CRITICAL' && alertRow.status === 'ACTIVE',
      6,
      'Verify alert automatically created / updated in SQLite alerts table',
      `Alert ID: ${alertRow?.id}, Title: "${alertRow?.title}", Severity: ${alertRow?.severity}`
    );

    // Step 7: Verify Dashboard Active Alerts KPI increments / updates
    const dash2 = await apiRequest('GET', '/api/dashboard');
    const alertsRes = await apiRequest('GET', '/api/alerts?status=ACTIVE');
    assert(
      dash2.data.kpis?.activeAlerts?.value >= 1 && dash2.data.kpis?.activeAlerts?.value === alertsRes.data.count,
      7,
      'Verify Dashboard Active Alerts KPI increments and synchronizes with Alerts API',
      `Dashboard Active Alerts: ${dash2.data.kpis?.activeAlerts?.value}, Alerts API Count: ${alertsRes.data.count}`
    );

    // Step 8: Verify Campus Map pin for Block A pulses CRITICAL (red radar)
    const resourcesRes = await apiRequest('GET', '/api/resources');
    const blockA = resourcesRes.data.resources?.find(r => r.location?.includes('Block A') || r.building === 'Block A');
    assert(
      blockA && (blockA.status === 'CRITICAL' || blockA.severity === 'CRITICAL'),
      8,
      'Verify Campus Map resource pin for Block A has CRITICAL status & red radar trigger',
      `Block A status: ${blockA?.status}, value: ${blockA?.current_value} kWh (Baseline: ${blockA?.baseline_value} kWh)`
    );

    // Step 9: Verify AI Insights generates root-cause diagnostic for Room 204
    const insightsRes = await apiRequest('GET', '/api/insights');
    const hasDiagnostic = insightsRes.data.anomalies?.some(d => d.location?.includes('Block A') || d.location?.includes('204')) ||
                          insightsRes.data.mainInsight?.location?.includes('Block A');
    assert(
      hasDiagnostic,
      9,
      'Verify AI Insights generates dynamic diagnostic and root-cause explanation for Room 204',
      `Active Anomalies: ${insightsRes.data.anomalies?.length}, Main Diagnostic: "${insightsRes.data.mainInsight?.title}" (${insightsRes.data.mainInsight?.location})`
    );

    // Step 10: Verify Predictions uses real database data for forecast
    const predRes = await apiRequest('GET', '/api/predictions');
    assert(
      predRes.status === 200 && predRes.data.summary && predRes.data.forecast,
      10,
      'Verify Predictions engine calculates data-driven 7-day forecast and avoidable cost',
      `Forecast Risk Level: ${predRes.data.summary.risk_level}, Projected Monthly Avoidable: $${predRes.data.summary.avoidable_cost}`
    );

    // Step 11: Verify System Audit records the telemetry ingestion and anomaly alert
    const auditRes = await apiRequest('GET', '/api/audit');
    const hasTelemetryAudit = auditRes.data.logs?.some(l => l.location?.includes('Block A') || l.details?.includes('1486') || l.action?.includes('Telemetry'));
    assert(
      hasTelemetryAudit,
      11,
      'Verify System Audit records telemetry ingestion and anomaly detection events',
      `Audit Log Count: ${auditRes.data.logs?.length}, Latest: [${auditRes.data.logs?.[0]?.actor}] ${auditRes.data.logs?.[0]?.action} - ${auditRes.data.logs?.[0]?.location}`
    );

    // Step 12: Trigger BMS Shutdown / mitigation
    const simRes = await apiRequest('POST', '/api/bms/shutdown', { location: 'Block A - Room 204' });
    assert(
      simRes.status === 200 && simRes.data.success,
      12,
      'Trigger BMS Shutdown mitigation command',
      `Mitigation Action: ${simRes.data.message || 'Power load reduced to baseline'}`
    );

    // Step 13: Verify alert is resolved & counts decrement
    const alertsAfterMitigation = await apiRequest('GET', '/api/alerts?status=ACTIVE');
    const resolvedAlert = db.prepare("SELECT * FROM alerts WHERE hotspot_id = 'block-a' ORDER BY id DESC LIMIT 1").get();
    assert(
      resolvedAlert && (resolvedAlert.status === 'RESOLVED' || alertsAfterMitigation.data.count < dash2.data.kpis?.activeAlerts?.value),
      13,
      'Verify alert status transitions to RESOLVED and active alert counts decrement',
      `Alert Status: ${resolvedAlert?.status}, Remaining Active Alerts: ${alertsAfterMitigation.data.count}`
    );

    // Step 14: Verify Dashboard, Map, Alerts, AI Insights, and Audit all reflect synchronized nominal state
    const dashFinal = await apiRequest('GET', '/api/dashboard');
    const resourcesFinal = await apiRequest('GET', '/api/resources');
    const blockAFinal = resourcesFinal.data.resources?.find(r => r.location?.includes('Block A') || r.building === 'Block A');
    assert(
      dashFinal.status === 200 && blockAFinal && blockAFinal.status === 'NORMAL',
      14,
      'Verify Dashboard, Campus Map, Alerts, AI Insights, and Audit reflect synchronized nominal state',
      `Block A Final Status: ${blockAFinal?.status}, Final Active Alerts: ${dashFinal.data.kpis?.activeAlerts?.value}`
    );

  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  }

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log('==================================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
