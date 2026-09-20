/**
 * ==========================================================================
 * NAXORA LIVE MAP DYNAMIC LOCATION & STATE SYNCHRONIZATION TEST
 * ==========================================================================
 */

const http = require('http');
const assert = require('assert');

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

async function runLiveMapLocationTests() {
    console.log('\n==================================================');
    console.log('NAXORA LIVE MAP LOCATION DISPLAY & SYNCHRONIZATION TEST');
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

    // Reset database to clean baseline
    await test('Reset system state via POST /api/reset', async () => {
        const res = await request('POST', '/reset', { facility_id: 'campus' });
        assert.strictEqual(res.status, 200);
    });

    // 1. Ingest Block A - Room 204
    await test('1. Ingest Telemetry: Block A - Room 204 (1486 kWh, Occ 0)', async () => {
        const res = await request('POST', '/telemetry', {
            location: 'Block A - Room 204',
            resourceType: 'electricity',
            value: 1486,
            unit: 'kWh',
            occupancy: 0,
            facility: 'campus',
            source: 'MANUAL_INPUT'
        });

        assert.ok(res.status === 200 || res.status === 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.hotspot.building, 'Block A');
        assert.strictEqual(res.body.hotspot.room, 'Room 204');
        assert.strictEqual(res.body.hotspot.currentValue, 1486);
        assert.strictEqual(res.body.hotspot.severity, 'CRITICAL');
    });

    // 2. Ingest Block B - Room 105
    await test('2. Ingest Telemetry: Block B - Room 105 (900 kWh, Occ 10)', async () => {
        const res = await request('POST', '/telemetry', {
            location: 'Block B - Room 105',
            resourceType: 'electricity',
            value: 900,
            unit: 'kWh',
            occupancy: 10,
            facility: 'campus',
            source: 'MANUAL_INPUT'
        });

        assert.ok(res.status === 200 || res.status === 201);
        assert.strictEqual(res.body.success, true);
        assert.strictEqual(res.body.hotspot.building, 'Block B');
        assert.strictEqual(res.body.hotspot.room, 'Room 105');
        assert.strictEqual(res.body.hotspot.currentValue, 900);
        assert.strictEqual(res.body.hotspot.severity, 'CRITICAL');
    });

    // 3. Verify Hotspots table from GET /api/hotspots contains both Block A - Room 204 and Block B - Room 105
    await test('3. Verify GET /api/hotspots contains accurate location, room, value, and severity', async () => {
        const res = await request('GET', '/hotspots?facility_id=campus');
        assert.strictEqual(res.status, 200);

        const blkA = res.body.hotspots.find(h => h.id === 'block-a');
        assert.ok(blkA, 'Block A hotspot must exist');
        assert.strictEqual(blkA.building, 'Block A');
        assert.strictEqual(blkA.room, 'Room 204');
        assert.strictEqual(blkA.current_value, 1486);
        assert.strictEqual(blkA.severity, 'CRITICAL');

        const blkB = res.body.hotspots.find(h => h.id === 'block-b');
        assert.ok(blkB, 'Block B hotspot must exist');
        assert.strictEqual(blkB.building, 'Block B');
        assert.strictEqual(blkB.room, 'Room 105');
        assert.strictEqual(blkB.current_value, 900);
        assert.strictEqual(blkB.severity, 'CRITICAL');
    });

    // 4. Verify simultaneous existence on Dashboard
    await test('4. Verify GET /api/dashboard contains simultaneous locations with synchronized severity', async () => {
        const res = await request('GET', '/dashboard?facility_id=campus');
        assert.strictEqual(res.status, 200);

        const hotspots = res.body.hotspots;
        const blkA = hotspots.find(h => h.id === 'block-a');
        const blkB = hotspots.find(h => h.id === 'block-b');

        assert.ok(blkA && blkB, 'Both Block A and Block B must exist simultaneously');
        assert.strictEqual(blkA.room, 'Room 204');
        assert.strictEqual(blkB.room, 'Room 105');
        assert.strictEqual(blkA.severity, 'CRITICAL');
        assert.strictEqual(blkB.severity, 'CRITICAL');
    });

    // 5. Update existing location (Block B - Room 105 to 950 kWh)
    await test('5. Re-ingest Block B - Room 105 updates existing marker without duplicating', async () => {
        const res = await request('POST', '/telemetry', {
            location: 'Block B - Room 105',
            resourceType: 'electricity',
            value: 950,
            unit: 'kWh',
            occupancy: 12,
            facility: 'campus',
            source: 'MANUAL_INPUT'
        });

        assert.ok(res.status === 200 || res.status === 201);
        assert.strictEqual(res.body.hotspot.currentValue, 950);

        const hotspotsRes = await request('GET', '/hotspots?facility_id=campus');
        const blkBList = hotspotsRes.body.hotspots.filter(h => h.id === 'block-b');
        assert.strictEqual(blkBList.length, 1, 'Exactly one Block B hotspot must exist');
        assert.strictEqual(blkBList[0].current_value, 950);
        assert.strictEqual(blkBList[0].room, 'Room 105');
    });

    // 6. Alert Resolution updates map marker state
    await test('6. Resolve Block A alert returns Block A marker to NORMAL while Block B remains CRITICAL', async () => {
        const alertsRes = await request('GET', '/alerts?status=ACTIVE');
        const blkAlert = alertsRes.body.alerts.find(a => a.location.includes('Block A'));
        assert.ok(blkAlert, 'Block A active alert must exist');

        const resolveRes = await request('POST', `/alerts/${blkAlert.id}/resolve`);
        assert.strictEqual(resolveRes.status, 200);

        const hotspotsRes = await request('GET', '/hotspots?facility_id=campus');
        const blkA = hotspotsRes.body.hotspots.find(h => h.id === 'block-a');
        const blkB = hotspotsRes.body.hotspots.find(h => h.id === 'block-b');

        assert.strictEqual(blkA.status, 'NORMAL');
        assert.strictEqual(blkA.severity, 'NORMAL');
        assert.strictEqual(blkA.room, 'Room 204', 'Room 204 location remains preserved');

        assert.strictEqual(blkB.status, 'CRITICAL');
        assert.strictEqual(blkB.severity, 'CRITICAL');
        assert.strictEqual(blkB.room, 'Room 105');
    });

    console.log('\n==================================================');
    console.log(`LIVE MAP TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runLiveMapLocationTests().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
