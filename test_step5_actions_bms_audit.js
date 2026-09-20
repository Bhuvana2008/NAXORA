/**
 * ==========================================================================
 * NAXORA STEP 5 TEST SUITE: COMPLETE ACTION LOOP, BMS, IMPACT & AUDIT
 * ==========================================================================
 */

const BASE_URL = 'http://localhost:5000/api';

async function runStep5Tests() {
    console.log('==================================================');
    console.log('NAXORA STEP 5 TEST SUITE: ACTIONS + BMS + AUDIT + IMPACT');
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
        assert(resetRes.ok && resetData.success, 'System reset via POST /api/reset');

        // ==================================================================
        // TEST A — CREATE ANOMALY
        // Location: Block A - Room 204, Electricity: 1486 kWh, Occupancy: 0
        // ==================================================================
        console.log('\n>>> TEST A: Create Anomaly (Block A - Room 204, 1486 kWh, Occ 0)');
        const telA = await fetch(`${BASE_URL}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'Block A - Room 204',
                resourceType: 'Electricity',
                value: 1486,
                unit: 'kWh',
                occupancy: 0,
                facility: 'campus',
                source: 'TEST_SUITE'
            })
        });
        const telAData = await telA.json();
        assert(telA.ok && telAData.diagnostic.severity === 'CRITICAL', 'Anomaly classified as CRITICAL (+139.7% deviation)');
        assert(telAData.alert && telAData.alert.status === 'ACTIVE', 'Active alert created / updated in central repository');

        // Check Dashboard KPI & Map Hotspot
        const dashA = await (await fetch(`${BASE_URL}/dashboard?facility=campus`)).json();
        assert(dashA.kpis.electricity.status === 'CRITICAL', 'Dashboard electricity status updated to CRITICAL');
        assert(dashA.kpis.activeAlerts.value >= 1, `Dashboard Active Alerts count: ${dashA.kpis.activeAlerts.value}`);

        // Check Audit Trail for Anomaly Detection
        const auditA = await (await fetch(`${BASE_URL}/audit`)).json();
        const anomLog = auditA.logs.find(l => l.action.includes('Anomaly detected') && l.location.includes('Block A'));
        assert(anomLog !== undefined, 'Audit trail recorded "Anomaly detected" event with location & severity');

        // ==================================================================
        // TEST B — APPLY ACTION (BMS Shutdown)
        // Click: Apply BMS Shutdown -> Backend action recorded, alert resolved,
        // dashboard/map/AI/audit updated, labeled "BMS Action Applied"
        // ==================================================================
        console.log('\n>>> TEST B: Apply Action via POST /api/actions/bms-shutdown');
        const bmsRes = await fetch(`${BASE_URL}/actions/bms-shutdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'Block A - Room 204',
                facility: 'campus'
            })
        });
        const bmsData = await bmsRes.json();
        assert(bmsRes.ok && bmsData.success, 'BMS Shutdown command executed successfully');
        assert(bmsData.action === 'BMS Action Applied', 'Action modeled accurately as "BMS Action Applied" without false hardware claims');
        assert(bmsData.beforeValue === 1486 && bmsData.mitigatedValue === 620, 'Pre-action load (1486 kWh) and mitigated target baseline (620 kWh) captured');
        assert(bmsData.energySavedKwh === 866, `Avoidable energy load calculated: ${bmsData.energySavedKwh} kWh`);
        assert(bmsData.costSavedRs > 0, `Avoidable cost savings calculated: Rs. ${bmsData.costSavedRs.toLocaleString()}`);

        // Verify Alert Status is RESOLVED with metadata
        const alertsB = await (await fetch(`${BASE_URL}/alerts?facility=campus`)).json();
        const blockAAlert = alertsB.alerts.find(a => a.location.includes('Block A'));
        assert(blockAAlert.status === 'RESOLVED', 'Block A alert status transitioned from ACTIVE to RESOLVED');
        assert(blockAAlert.resolvedAt !== null, 'Alert contains resolvedAt timestamp');

        // Verify Dashboard & Map Hotspot return to NORMAL
        const dashB = await (await fetch(`${BASE_URL}/dashboard?facility=campus`)).json();
        const blockAHotspot = dashB.hotspots.find(h => h.id === 'block-a');
        assert(blockAHotspot.status === 'NORMAL' && blockAHotspot.severity === 'NORMAL', 'Campus map hotspot for Block A returned to NORMAL status');

        // Verify Audit Trail records BMS Action Applied
        const auditB = await (await fetch(`${BASE_URL}/audit`)).json();
        const bmsLog = auditB.logs.find(l => l.action.includes('BMS Action Applied') && l.location.includes('Block A'));
        assert(bmsLog !== undefined, 'Audit trail recorded "BMS Action Applied" event');

        // ==================================================================
        // TEST C — POST-ACTION TELEMETRY
        // Send a new reading for Block A - Room 204 (lower value e.g. 580 kWh).
        // System must compare new reading with previous state and calculate actual savings.
        // ==================================================================
        console.log('\n>>> TEST C: Post-Action Telemetry & Impact Verification');
        const telC = await fetch(`${BASE_URL}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'Block A - Room 204',
                resourceType: 'Electricity',
                value: 580,
                unit: 'kWh',
                occupancy: 2,
                facility: 'campus',
                source: 'TEST_SUITE'
            })
        });
        const telCData = await telC.json();
        assert(telC.ok && telCData.success, 'Post-action telemetry (580 kWh) received for Block A');
        assert(telCData.postActionImpact && telCData.postActionImpact.hasPostActionTelemetry, 'Post-action impact verification triggered');
        assert(telCData.postActionImpact.beforeValue === 1486 && telCData.postActionImpact.postActionValue === 580, 'Measured exact before (1486 kWh) vs after (580 kWh) values');
        assert(telCData.postActionImpact.savedResource === 906, `Verified saved resource: ${telCData.postActionImpact.savedResource} kWh`);
        assert(telCData.postActionImpact.costSaved > 0, `Verified monthly cost avoidance: Rs. ${telCData.postActionImpact.costSaved.toLocaleString()}`);

        // Verify Audit Trail recorded Post-Action Telemetry Verified
        const auditC = await (await fetch(`${BASE_URL}/audit`)).json();
        const postLog = auditC.logs.find(l => l.action.includes('Post-Action Telemetry Verified'));
        assert(postLog !== undefined, 'Audit trail recorded "Post-Action Telemetry Verified" event');

        // ==================================================================
        // TEST D — DIFFERENT LOCATION (Block B - Room 105)
        // Ensure Room 105 data is completely isolated from Room 204.
        // ==================================================================
        console.log('\n>>> TEST D: Different Location Isolation (Block B - Room 105, 900 kWh)');
        const telD = await fetch(`${BASE_URL}/telemetry`, {
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
        const telDData = await telD.json();
        assert(telD.ok && telDData.diagnostic.severity === 'CRITICAL', 'Block B - Room 105 anomaly detected (+125.0% above 400 kWh baseline)');
        assert(telDData.location === 'Block B - Room 105', 'Location explicitly preserved as Block B - Room 105');

        const dashD = await (await fetch(`${BASE_URL}/dashboard?facility=campus`)).json();
        const bldBHotspot = dashD.hotspots.find(h => h.id === 'block-b' || h.building.includes('Block B'));
        const bldAHotspot = dashD.hotspots.find(h => h.id === 'block-a' || h.building.includes('Block A'));
        assert(bldBHotspot.severity === 'CRITICAL' && bldBHotspot.current_value === 900, 'Block B hotspot is CRITICAL (900 kWh)');
        assert(bldAHotspot.severity === 'NORMAL' && bldAHotspot.current_value === 580, 'Block A remains NORMAL (580 kWh) and is NOT polluted by Block B');

        // ==================================================================
        // TEST E — ACTION SAFETY & VALIDATIONS
        // Reject BMS shutdown on resolved alert or non-existent alert
        // ==================================================================
        console.log('\n>>> TEST E: Action Safety Validations');
        // 1. Try to apply BMS on an already resolved alert
        const safeRes1 = await fetch(`${BASE_URL}/actions/bms-shutdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId: blockAAlert.id })
        });
        const safeData1 = await safeRes1.json();
        assert(safeRes1.status === 400 && safeData1.error.includes('already resolved'), 'Safety check rejected BMS shutdown on already resolved alert');

        // 2. Try to apply BMS on non-existent alert
        const safeRes2 = await fetch(`${BASE_URL}/actions/bms-shutdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId: 999999 })
        });
        assert(safeRes2.status === 404, 'Safety check rejected BMS shutdown on non-existent alert ID (404)');

        // ==================================================================
        // TEST F — PERSISTENCE ACROSS RE-FETCH
        // ==================================================================
        console.log('\n>>> TEST F: Data Persistence Verification');
        const finalAudit = await (await fetch(`${BASE_URL}/audit`)).json();
        assert(finalAudit.logs.length >= 5, `Audit ledger contains ${finalAudit.logs.length} immutable events`);

        const finalReports = await (await fetch(`${BASE_URL}/reports?facility=campus`)).json();
        assert(finalReports.resolvedAlertsCount >= 1, `Reports show ${finalReports.resolvedAlertsCount} resolved alerts`);
        assert(finalReports.recentBmsActions.length >= 1, `Reports show ${finalReports.recentBmsActions.length} recorded BMS actions`);

    } catch (err) {
        console.error('Test execution exception:', err);
        failed++;
    }

    console.log('\n==================================================');
    console.log(`STEP 5 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log('==================================================\n');

    process.exit(failed > 0 ? 1 : 0);
}

runStep5Tests();
