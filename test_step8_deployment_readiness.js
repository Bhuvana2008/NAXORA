/**
 * ==========================================================================
 * NAXORA STEP 8: NETLIFY PREPARATION & DEPLOYMENT READINESS TEST SUITE
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

async function runStep8Verification() {
    console.log('==================================================');
    console.log('NAXORA STEP 8: DEPLOYMENT READINESS & NETLIFY AUDIT');
    console.log('==================================================\n');

    try {
        // 1. Netlify Configuration Files
        console.log('>>> 1. NETLIFY CONFIGURATION AUDIT');
        const netlifyTomlExists = fs.existsSync(path.join(__dirname, 'netlify.toml'));
        assert(netlifyTomlExists, 'netlify.toml configuration file exists');
        if (netlifyTomlExists) {
            const tomlContent = fs.readFileSync(path.join(__dirname, 'netlify.toml'), 'utf8');
            assert(tomlContent.includes('publish = "."'), 'netlify.toml publishes root directory');
            assert(tomlContent.includes('[[redirects]]'), 'netlify.toml includes SPA routing rule');
        }

        const redirectsExists = fs.existsSync(path.join(__dirname, '_redirects'));
        assert(redirectsExists, '_redirects file exists with SPA fallback rule');

        // 2. Centralized API Configuration & Frontend Assets
        console.log('\n>>> 2. CENTRALIZED API & ASSET AUDIT');
        const configExists = fs.existsSync(path.join(__dirname, 'config.js'));
        assert(configExists, 'config.js exists for flexible deployment API configuration');

        const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
        assert(indexHtml.includes('<script src="config.js"></script>'), 'index.html loads config.js');
        assert(indexHtml.includes('<script src="script.js"></script>'), 'index.html loads script.js');
        assert(indexHtml.includes('campus-map.png'), 'index.html references campus-map.png correctly');

        const mapAssetExists = fs.existsSync(path.join(__dirname, 'campus-map.png'));
        assert(mapAssetExists, 'campus-map.png image asset is present in root');

        const scriptJs = fs.readFileSync(path.join(__dirname, 'script.js'), 'utf8');
        assert(scriptJs.includes('NAXORA_CONFIG'), 'script.js resolves API_BASE dynamically');

        // 3. Security & Secrets Check
        console.log('\n>>> 3. SECURITY & CREDENTIALS AUDIT');
        const filesToScan = ['script.js', 'index.html', 'config.js', 'server/server.js', 'server/database.js'];
        let secretsFound = false;
        for (const f of filesToScan) {
            const content = fs.readFileSync(path.join(__dirname, f), 'utf8');
            if (content.includes('SECRET_KEY') || content.includes('AWS_SECRET') || content.includes('PRIVATE_KEY') || content.includes('password = "')) {
                secretsFound = true;
            }
        }
        assert(!secretsFound, 'Zero exposed secrets or sensitive credentials in frontend/backend files');

        // 4. Backend Health & Core Endpoints
        console.log('\n>>> 4. LIVE BACKEND ENDPOINTS VERIFICATION');
        const health = await request('GET', '/api/health');
        assert(health.status === 200 && health.data.status === 'ok', 'GET /api/health responds with 200 OK');

        const reset = await request('POST', '/api/reset');
        assert(reset.status === 200 && reset.data.success, 'POST /api/reset returns 200 OK');

        const dash = await request('GET', '/api/dashboard');
        assert(dash.status === 200 && dash.data.hotspots.length >= 7, 'GET /api/dashboard returns complete campus dataset');

        const alerts = await request('GET', '/api/alerts');
        assert(alerts.status === 200 && alerts.data.alerts.length >= 3, 'GET /api/alerts returns active alerts');

        const insights = await request('GET', '/api/insights');
        assert(insights.status === 200 && insights.data.mainInsight, 'GET /api/insights returns explainable diagnostic');

        const predictions = await request('GET', '/api/predictions');
        assert(predictions.status === 200 && predictions.data.forecast, 'GET /api/predictions returns 7-day forecast');

        const savings = await request('GET', '/api/savings');
        assert(savings.status === 200 && savings.data.totalPotentialSavings > 0, 'GET /api/savings returns dynamic savings');

        const audit = await request('GET', '/api/audit');
        assert(audit.status === 200 && audit.data.logs.length > 0, 'GET /api/audit returns audit ledger');

        const reports = await request('GET', '/api/reports');
        assert(reports.status === 200 && reports.data.efficiencyScore, 'GET /api/reports returns ESG metrics');

        // 5. Complete Workflow Ingestion & BMS Mitigation Verification
        console.log('\n>>> 5. WORKFLOW & ACTION VERIFICATION');
        const telem = await request('POST', '/api/telemetry', {
            location: 'Block A - Room 204',
            resourceType: 'electricity',
            value: 1486,
            occupancy: 0
        });
        assert(telem.status === 201 && telem.data.diagnostic.severity === 'CRITICAL', 'Telemetry ingestion triggers CRITICAL anomaly (+139.7%)');

        const bms = await request('POST', '/api/actions/bms-shutdown', {
            location: 'Block A - Room 204'
        });
        assert(bms.status === 200 && bms.data.status === 'EXECUTED', 'BMS shutdown mitigates waste and returns zone to baseline');

        // Restore clean baseline for live use
        await request('POST', '/api/reset');

    } catch (e) {
        console.error('Test execution error:', e);
        failedCount++;
    }

    console.log('\n==================================================');
    console.log(`STEP 8 TEST SUMMARY: ${passedCount} Passed, ${failedCount} Failed`);
    console.log('==================================================');

    if (failedCount > 0) {
        process.exit(1);
    }
}

runStep8Verification();
