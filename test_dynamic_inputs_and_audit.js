// test_dynamic_inputs_and_audit.js
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
  console.log('=== RUNNING NAXORA DYNAMIC INPUTS & AUDIT REFRESH VERIFICATION ===\n');
  const db = new DatabaseSync(DB_PATH);
  let passed = 0;
  let failed = 0;

  function assert(condition, testNum, description, details = '') {
    if (condition) {
      console.log(`[PASS] Test ${testNum}: ${description}`);
      if (details) console.log(`       ↳ ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] Test ${testNum}: ${description}`);
      if (details) console.error(`       ↳ ${details}`);
      failed++;
    }
  }

  try {
    // Reset baseline first
    await apiRequest('POST', '/api/reset');

    // ----------------------------------------------------
    // TEST 1: Block A - Room 204 (Electricity, 1486 kWh, Occ 0)
    // ----------------------------------------------------
    const t1Payload = {
      location: "Block A - Room 204",
      resourceType: "electricity",
      value: 1486,
      unit: "kWh",
      occupancy: 0
    };
    const res1 = await apiRequest('POST', '/api/telemetry', t1Payload);
    const reading1 = db.prepare("SELECT * FROM resource_readings WHERE room_id = 'Room 204' AND building_id = 'Block A' ORDER BY id DESC LIMIT 1").get();
    const alert1 = db.prepare("SELECT * FROM alerts WHERE location = 'Block A - Room 204' AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1").get();
    
    assert(
      res1.status === 201 && res1.data.location === 'Block A - Room 204' && reading1 && reading1.value === 1486 && alert1,
      1,
      'Test 1: Ingest "Block A - Room 204" (1486 kWh, 0 Occ)',
      `Location: "${res1.data?.location}", Anomaly Status: ${res1.data?.diagnostic?.status} (+${res1.data?.diagnostic?.deviationPercent}%), Alert ID: ${alert1?.id}`
    );

    // ----------------------------------------------------
    // TEST 2: Block B - Room 105 (Electricity, 900 kWh, Occ 10)
    // ----------------------------------------------------
    const t2Payload = {
      location: "Block B - Room 105",
      resourceType: "electricity",
      value: 900,
      unit: "kWh",
      occupancy: 10
    };
    const res2 = await apiRequest('POST', '/api/telemetry', t2Payload);
    const reading2 = db.prepare("SELECT * FROM resource_readings WHERE room_id = 'Room 105' AND building_id = 'Block B' ORDER BY id DESC LIMIT 1").get();
    const alert2 = db.prepare("SELECT * FROM alerts WHERE location = 'Block B - Room 105' AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1").get();

    assert(
      res2.status === 201 && res2.data.location === 'Block B - Room 105' && reading2 && reading2.value === 900 && alert2,
      2,
      'Test 2: Ingest "Block B - Room 105" (900 kWh, 10 Occ) — NOT converted to Room 204',
      `Location: "${res2.data?.location}", Stored DB Location: "${reading2?.building_id} - ${reading2?.room_id}", Baseline: ${res2.data?.baseline} kWh, Alert ID: ${alert2?.id}`
    );

    // ----------------------------------------------------
    // TEST 3: Lab 2 (Water, 500 L, Occ 20)
    // ----------------------------------------------------
    const t3Payload = {
      location: "Lab 2",
      resourceType: "water",
      value: 500,
      unit: "L",
      occupancy: 20
    };
    const res3 = await apiRequest('POST', '/api/telemetry', t3Payload);
    const reading3 = db.prepare("SELECT * FROM resource_readings WHERE building_id = 'Lab 2' AND resource_type = 'Water' ORDER BY id DESC LIMIT 1").get();
    const alert3 = db.prepare("SELECT * FROM alerts WHERE (location LIKE '%Lab 2%' OR hotspot_id = 'lab-2') AND status = 'ACTIVE' ORDER BY id DESC LIMIT 1").get();

    assert(
      res3.status === 201 && res3.data.location === 'Lab 2' && reading3 && reading3.value === 500 && alert3,
      3,
      'Test 3: Ingest "Lab 2" (500 L, 20 Occ) — NOT converted to Room 204',
      `Location: "${res3.data?.location}", Stored DB Location: "${reading3?.building_id}", Baseline: ${res3.data?.baseline} L, Alert ID: ${alert3?.id}`
    );

    // ----------------------------------------------------
    // TEST 4: Baseline Learning for Brand New Location
    // ----------------------------------------------------
    const t4Payload = {
      location: "Innovation Hub - Workshop 3",
      resourceType: "electricity",
      value: 320,
      unit: "kWh",
      occupancy: 5
    };
    const res4 = await apiRequest('POST', '/api/telemetry', t4Payload);
    const reading4 = db.prepare("SELECT * FROM resource_readings WHERE building_id = 'Innovation Hub' ORDER BY id DESC LIMIT 1").get();

    assert(
      res4.status === 201 && res4.data.diagnostic?.isLearning === true && res4.data.diagnostic?.status === 'NORMAL' && reading4,
      4,
      'Test 4: Brand New Location "Innovation Hub - Workshop 3" enters Baseline Learning mode without false anomaly',
      `Status: ${res4.data?.diagnostic?.status}, Reason: "${res4.data?.diagnostic?.reason}"`
    );

    // ----------------------------------------------------
    // TEST 5: System Audit Trail Refresh & Latest Logs
    // ----------------------------------------------------
    const auditRes = await apiRequest('GET', `/api/audit?category=ALL&t=${Date.now()}`);
    const latestLogs = auditRes.data.logs || [];
    const hasT1 = latestLogs.some(l => l.location === 'Block A - Room 204');
    const hasT2 = latestLogs.some(l => l.location === 'Block B - Room 105');
    const hasT3 = latestLogs.some(l => l.location === 'Lab 2');
    const hasT4 = latestLogs.some(l => l.location === 'Innovation Hub - Workshop 3');

    assert(
      auditRes.status === 200 && latestLogs.length >= 4 && hasT1 && hasT2 && hasT3 && hasT4,
      5,
      'Test 5: Audit Trail GET /api/audit retrieves all distinct locations correctly on Refresh',
      `Total Logs: ${latestLogs.length}, Found Locations: Block A - Room 204 (${hasT1}), Block B - Room 105 (${hasT2}), Lab 2 (${hasT3}), Innovation Hub (${hasT4})`
    );

    // ----------------------------------------------------
    // TEST 6: AI Insights, Dashboard, and Predictions reflect dynamic submitted locations
    // ----------------------------------------------------
    const dashRes = await apiRequest('GET', '/api/dashboard');
    const insightsRes = await apiRequest('GET', '/api/insights');
    const predRes = await apiRequest('GET', '/api/predictions');

    const hasBlockBInInsights = insightsRes.data.anomalies?.some(a => a.location?.includes('Block B') || a.building?.includes('Block B'));
    const hasLab2InInsights = insightsRes.data.anomalies?.some(a => a.location?.includes('Lab 2') || a.building?.includes('Lab 2'));

    assert(
      dashRes.status === 200 && insightsRes.status === 200 && predRes.status === 200 && hasBlockBInInsights && hasLab2InInsights,
      6,
      'Test 6: AI Insights, Dashboard, and Predictions all reflect multi-location anomalies dynamically',
      `Active Anomalies in AI Insights: ${insightsRes.data.anomalies?.length} (Includes Block B: ${hasBlockBInInsights}, Lab 2: ${hasLab2InInsights})`
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
