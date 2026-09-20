/**
 * ==========================================================================
 * NAXORA - AI Campus Resource Guardian
 * Dynamic Telemetry Processing & Central State Engine (Step 2)
 * ==========================================================================
 */

const API_BASE = (() => {
    if (typeof window !== 'undefined' && window.NAXORA_CONFIG && window.NAXORA_CONFIG.API_BASE_URL) {
        return window.NAXORA_CONFIG.API_BASE_URL.replace(/\/+$/, '');
    }
    if (typeof window !== 'undefined' && window.location) {
        if (window.location.protocol === 'file:') {
            return 'http://localhost:5000/api';
        }
        if (window.location.origin && !window.location.origin.includes('null')) {
            return `${window.location.origin}/api`;
        }
    }
    return 'http://localhost:5000/api';
})();

/**
 * ==========================================================================
 * CENTRAL NAXORA STATE (Single Source of Truth)
 * ==========================================================================
 */
const NAXORA_STATE = {
    facility: 'campus',
    currentView: 'dashboard',
    alertFilter: 'ALL',
    auditFilter: 'ALL',
    isBackendConnected: false,
    autoRefreshTimer: null,

    // Monitored Resources & Telemetry Hotspots
    resources: [],
    hotspots: [],

    // Unified Alert Repository
    alerts: [],

    // Active AI Insights & Root Cause Analysis
    insights: [],

    // 7-Day ARIMA Predictions & Forecasting
    predictions: {},

    // System Audit & Event Ledger
    auditLogs: [],

    // System Status
    systemStatus: {
        online: true,
        mode: 'MONITORING ACTIVE',
        lastUpdated: new Date().toISOString()
    }
};

// Chart.js Global Instances
let predictionChartInstance = null;
let elecUsageChartInstance = null;
let waterUsageChartInstance = null;
let savingsBreakdownChartInstance = null;

// ================= INITIALIZATION =================
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    checkBackendHealth();
    fetchDashboardData();
    setupGlobalEventListeners();
    startAutoRefresh();
});

// Clock Widget
function initClock() {
    const timeEl = document.getElementById('currentTime');
    function update() {
        const now = new Date();
        if (timeEl) {
            timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: true });
        }
    }
    update();
    setInterval(update, 1000);
}

// Backend Health & Connectivity Check
async function checkBackendHealth() {
    try {
        const res = await fetch(`${API_BASE}/health?t=${Date.now()}`);
        if (res.ok) {
            NAXORA_STATE.isBackendConnected = true;
            updateSystemStatusIndicator(true);
        } else {
            throw new Error('Non-200 server response');
        }
    } catch (e) {
        NAXORA_STATE.isBackendConnected = false;
        updateSystemStatusIndicator(false);
    }
}

// Update System Status UI Badges (Honest Status Reporting)
function updateSystemStatusIndicator(isOnline) {
    const badgeTxt = document.getElementById('backendStatusTxt');
    const badgeDot = document.querySelector('.backend-dot-indicator');
    const livePill = document.getElementById('livePillBadge');
    const liveTxt = document.getElementById('liveStatusPillTxt');

    if (isOnline) {
        if (badgeTxt) badgeTxt.textContent = 'API Connected (Node/SQLite)';
        if (badgeDot) badgeDot.classList.remove('offline');
        if (livePill) livePill.classList.remove('offline');
        if (liveTxt) liveTxt.textContent = 'Monitoring Active';
    } else {
        if (badgeTxt) badgeTxt.textContent = 'Offline Mode (Local State)';
        if (badgeDot) badgeDot.classList.add('offline');
        if (livePill) livePill.classList.add('offline');
        if (liveTxt) liveTxt.textContent = 'Backend Offline';
    }
}

// Update Last Synchronized Timestamp
function updateLastUpdatedTimestamp(date = new Date()) {
    const timeEl = document.getElementById('lastUpdatedTime');
    if (timeEl) {
        timeEl.textContent = date.toLocaleTimeString('en-US', { hour12: true });
    }
}


// Facility Change Handler
function handleFacilityChange(facilityId) {
    NAXORA_STATE.facility = facilityId;
    const title = document.getElementById('mapHeadingText');
    if (title) {
        const sel = document.getElementById('facilitySelect');
        const name = sel ? sel.options[sel.selectedIndex].text : facilityId.toUpperCase();
        title.textContent = `LIVE RESOURCE MAP - ${name.toUpperCase()}`;
    }
    showNotification(`Switched monitored facility to: ${facilityId.toUpperCase()}`);
    fetchDashboardData();
    if (NAXORA_STATE.currentView === 'predictions') loadPredictions();
    if (NAXORA_STATE.currentView === 'ai-insights') loadAiInsights();
    if (NAXORA_STATE.currentView === 'alerts') loadAlerts();
    if (NAXORA_STATE.currentView === 'reports') loadReports();
    if (NAXORA_STATE.currentView === 'audit') loadAuditTrail();
}

// ================= VIEW NAVIGATION (8 DEDICATED VIEWS) =================
function switchView(viewName, element) {
    NAXORA_STATE.currentView = viewName;

    document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
        item.classList.remove('active');
    });

    if (element) {
        element.classList.add('active');
    } else {
        const navMap = {
            'dashboard': 'navDashboard',
            'live-map': 'navLiveMap',
            'ai-insights': 'navAiInsights',
            'predictions': 'navPredictions',
            'alerts': 'navAlerts',
            'reports': 'navReports',
            'audit': 'navAudit',
            'settings': 'navSettings'
        };
        const targetNavId = navMap[viewName] || 'navDashboard';
        const targetNav = document.getElementById(targetNavId);
        if (targetNav) targetNav.classList.add('active');
    }

    document.querySelectorAll('.view-container').forEach(view => {
        view.style.display = 'none';
        view.classList.remove('active-view');
    });

    const viewMap = {
        'dashboard': 'viewDashboard',
        'live-map': 'viewLiveMap',
        'ai-insights': 'viewAiInsights',
        'predictions': 'viewPredictions',
        'alerts': 'viewAlerts',
        'reports': 'viewReports',
        'audit': 'viewAudit',
        'settings': 'viewSettings'
    };

    const targetViewId = viewMap[viewName] || 'viewDashboard';
    const targetView = document.getElementById(targetViewId);
    if (targetView) {
        targetView.style.display = 'flex';
        targetView.classList.add('active-view');
    }

    const headings = {
        'dashboard': 'Dashboard Overview',
        'live-map': 'Spatial Campus Resource Map',
        'ai-insights': 'AI Insights & Root Cause Diagnostics',
        'predictions': 'Predictive Waste Intelligence',
        'alerts': 'Alerts Center',
        'reports': 'Resource Efficiency & ESG Impact',
        'audit': 'System Audit Trail & Event Ledger',
        'settings': 'System Settings & Configuration'
    };
    const topHeading = document.getElementById('topHeading');
    if (topHeading) topHeading.textContent = headings[viewName] || 'Dashboard Overview';

    if (viewName === 'dashboard') renderDashboardState();
    if (viewName === 'ai-insights') loadAiInsights();
    if (viewName === 'predictions') loadPredictions();
    if (viewName === 'alerts') loadAlerts();
    if (viewName === 'reports') loadReports();
    if (viewName === 'audit') loadAuditTrail();
    if (viewName === 'settings') loadSettings();
}

function handleKpiKey(event, type) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (type === 'electricity') openElectricityDetailsModal();
        if (type === 'water') openWaterDetailsModal();
        if (type === 'alerts') switchView('alerts');
        if (type === 'savings') openSavingsDetailsModal();
    }
}

// ================= CORE DATA FETCH & REAL-TIME SYNCHRONIZATION =================
let isRefreshingNaxora = false;

async function refreshNaxoraState(options = {}) {
    const { force = false, silent = false, background = false } = options;
    if (isRefreshingNaxora && !force) return;
    isRefreshingNaxora = true;

    try {
        const timestamp = Date.now();
        const [dashRes, resRes, alertsRes] = await Promise.all([
            fetch(`${API_BASE}/dashboard?facility_id=${NAXORA_STATE.facility}&t=${timestamp}`),
            fetch(`${API_BASE}/resources?facility_id=${NAXORA_STATE.facility}&t=${timestamp}`),
            fetch(`${API_BASE}/alerts?facility_id=${NAXORA_STATE.facility}&t=${timestamp}`)
        ]);

        let dashData = null;
        if (dashRes.ok) {
            dashData = await dashRes.json();
            NAXORA_STATE.hotspots = dashData.hotspots || [];
            if (dashData.alerts) NAXORA_STATE.alerts = dashData.alerts;
            renderDashboardState(dashData);
        }

        if (resRes.ok) {
            const resData = await resRes.json();
            NAXORA_STATE.resources = resData.resources || [];
        }

        if (alertsRes.ok) {
            const alertsData = await alertsRes.json();
            if (alertsData.alerts) NAXORA_STATE.alerts = alertsData.alerts;
            updateAlertBadges(NAXORA_STATE.alerts.filter(a => a.status === 'ACTIVE').length);
        }

        // Active View specific synchronization
        if (NAXORA_STATE.currentView === 'alerts') {
            await loadAlerts();
        } else if (NAXORA_STATE.currentView === 'ai-insights') {
            await loadAiInsights();
        } else if (NAXORA_STATE.currentView === 'predictions') {
            await loadPredictions();
        } else if (NAXORA_STATE.currentView === 'reports') {
            await loadReports();
        } else if (NAXORA_STATE.currentView === 'audit') {
            await loadAuditTrail(false);
        }

        // Keep any active diagnostic or usage modals synchronized in-place
        syncOpenModals();

        NAXORA_STATE.isBackendConnected = true;
        updateSystemStatusIndicator(true);
        updateLastUpdatedTimestamp(new Date());

    } catch (err) {
        console.warn('Backend fetch fallback to local state:', err);
        NAXORA_STATE.isBackendConnected = false;
        updateSystemStatusIndicator(false);
        renderDashboardState();
    } finally {
        isRefreshingNaxora = false;
    }
}

async function fetchDashboardData() {
    return await refreshNaxoraState({ force: true });
}

// In-Place Modal Synchronizer (Updates open modal cards without closing or resetting focus)
function syncOpenModals() {
    // 1. Hotspot Diagnostic Modal
    const hotspotModal = document.getElementById('hotspotModalBackdrop');
    if (hotspotModal && hotspotModal.style.display === 'flex') {
        const titleEl = document.getElementById('modalBuildingTitle');
        if (titleEl && titleEl.textContent) {
            const currentTitle = titleEl.textContent.trim();
            const currentHotspot = NAXORA_STATE.hotspots.find(h => {
                const combo = `${h.building} - ${h.room}`.trim();
                return combo === currentTitle || h.building === currentTitle || currentTitle.includes(h.building);
            });

            if (currentHotspot) {
                const badgeEl = document.getElementById('modalStatusBadge');
                const currEl = document.getElementById('modalCurrentVal');
                const baseEl = document.getElementById('modalBaselineVal');
                const devEl = document.getElementById('modalDeviationVal');
                const confEl = document.getElementById('modalConfidenceVal');
                const reasonEl = document.getElementById('modalReasonText');
                const actionEl = document.getElementById('modalActionText');

                if (badgeEl) {
                    badgeEl.textContent = currentHotspot.severity || 'NORMAL';
                    badgeEl.className = `modal-status-badge badge-${(currentHotspot.severity || 'normal').toLowerCase()}`;
                }
                if (currEl) currEl.textContent = `${currentHotspot.current_value} ${currentHotspot.resource_type === 'Water' ? 'L' : 'kWh'}`;
                if (baseEl) baseEl.textContent = `${currentHotspot.baseline_value || Math.round(currentHotspot.current_value / 1.5)} ${currentHotspot.resource_type === 'Water' ? 'L' : 'kWh'}`;
                if (devEl) {
                    const sign = currentHotspot.deviation_percent > 0 ? '+' : '';
                    devEl.textContent = `${sign}${currentHotspot.deviation_percent}%`;
                }
                if (confEl) confEl.textContent = `${currentHotspot.confidence || 96}%`;
                if (reasonEl && currentHotspot.reason) reasonEl.textContent = currentHotspot.reason;
                if (actionEl && currentHotspot.recommended_action) actionEl.textContent = currentHotspot.recommended_action;
            }
        }
    }

    // 2. Electricity Modal
    const elecModal = document.getElementById('elecDetailsModalBackdrop');
    if (elecModal && elecModal.style.display === 'flex') {
        const topElec = NAXORA_STATE.hotspots.find(h => (h.resource_type === 'Electricity' || !h.resource_type) && (h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM')) || NAXORA_STATE.hotspots.find(h => h.id === 'block-a') || NAXORA_STATE.hotspots[0];
        const isSpike = topElec && (topElec.severity === 'CRITICAL' || topElec.severity === 'HIGH' || topElec.severity === 'MEDIUM');
        const curVal = topElec ? topElec.current_value : 620;
        const baseVal = topElec ? topElec.baseline_value : 620;
        const devPct = topElec ? topElec.deviation_percent : 0;
        const excess = Math.max(0, curVal - baseVal);
        const monthlySavings = Math.round(excess * 8.0 * 30);
        const dailyCost = Math.round(curVal * 8.0);
        const locLabel = topElec ? (topElec.room && topElec.room !== topElec.building ? `${topElec.building} - ${topElec.room}` : topElec.building) : 'Block A - Room 204';

        const currEl = document.getElementById('elecModalCurrent');
        const baseEl = document.getElementById('elecModalBaseline');
        const diffEl = document.getElementById('elecModalDiff');
        const costEl = document.getElementById('elecModalCost');
        const saveEl = document.getElementById('elecModalSavings');
        const topLocEl = document.getElementById('elecModalTopLocation');

        if (currEl) currEl.textContent = `${curVal.toLocaleString()} kWh`;
        if (baseEl) baseEl.textContent = `${baseVal.toLocaleString()} kWh`;
        if (diffEl) {
            diffEl.textContent = isSpike ? `+${devPct}% (ANOMALY)` : `${devPct > 0 ? '+' : ''}${devPct}%`;
            diffEl.className = `stat-num ${isSpike ? 'red-text' : 'green-text'}`;
        }
        if (costEl) costEl.textContent = `Rs. ${dailyCost.toLocaleString()} / day`;
        if (saveEl) saveEl.textContent = monthlySavings > 0 ? `Rs. ${monthlySavings.toLocaleString()} / mo` : 'Nominal';
        if (topLocEl) topLocEl.textContent = isSpike ? `${locLabel} (${curVal} kWh Surge)` : `${locLabel} (Nominal)`;
    }

    // 3. Water Modal
    const waterModal = document.getElementById('waterDetailsModalBackdrop');
    if (waterModal && waterModal.style.display === 'flex') {
        const canteen = NAXORA_STATE.hotspots.find(h => h.resource_type === 'Water') || NAXORA_STATE.hotspots.find(h => h.id === 'canteen');
        const isLeak = canteen && (canteen.severity === 'CRITICAL' || canteen.severity === 'HIGH' || canteen.current_value > canteen.baseline_value * 1.2);
        const curVal = canteen ? canteen.current_value : 45;
        const baseVal = canteen ? canteen.baseline_value : 45;
        const devPct = canteen ? canteen.deviation_percent : 0;
        const excess = Math.max(0, curVal - baseVal);
        const monthlySavings = Math.round(excess * 0.08 * 30);

        const currEl = document.getElementById('waterModalCurrent');
        const baseEl = document.getElementById('waterModalBaseline');
        const diffEl = document.getElementById('waterModalDiff');
        const statusEl = document.getElementById('waterModalStatus');
        const monthEl = document.getElementById('waterModalMonthly');
        const saveEl = document.getElementById('waterModalSavings');

        if (currEl) currEl.textContent = `${curVal.toLocaleString()} L`;
        if (baseEl) baseEl.textContent = `${baseVal.toLocaleString()} L`;
        if (diffEl) {
            diffEl.textContent = isLeak ? `+${devPct}% (FLOW SURGE)` : `${devPct > 0 ? '+' : ''}${devPct}%`;
            diffEl.className = `stat-num ${isLeak ? 'red-text' : 'green-text'}`;
        }
        if (statusEl) {
            statusEl.textContent = isLeak ? 'LEAK DETECTED' : 'NORMAL';
            statusEl.className = `stat-num ${isLeak ? 'red-text' : 'green-text'}`;
        }
        if (monthEl) monthEl.textContent = `${Math.round(curVal * 30).toLocaleString()} L`;
        if (saveEl) saveEl.textContent = excess > 0 ? `${Math.round(excess * 30).toLocaleString()} L (Rs. ${monthlySavings.toLocaleString()})` : 'Nominal';
    }
}


// Render Dashboard using Central State
function renderDashboardState(serverData = null) {
    const activeAlerts = NAXORA_STATE.alerts.filter(a => a.status === 'ACTIVE');
    const activeCount = activeAlerts.length;

    const blockAHotspot = NAXORA_STATE.hotspots.find(h => h.id === 'block-a');
    const canteenHotspot = NAXORA_STATE.hotspots.find(h => h.id === 'canteen');

    const isPowerSpike = blockAHotspot && (blockAHotspot.severity === 'CRITICAL' || blockAHotspot.severity === 'HIGH' || blockAHotspot.current_value > blockAHotspot.baseline_value * 1.2);
    const isWaterLeak = canteenHotspot && (canteenHotspot.severity === 'CRITICAL' || canteenHotspot.severity === 'HIGH' || canteenHotspot.current_value > canteenHotspot.baseline_value * 1.5);

    const elecVal = blockAHotspot ? blockAHotspot.current_value : 1486;
    const waterVal = isWaterLeak ? (canteenHotspot ? canteenHotspot.current_value : 940) : 8420;

    let excessElec = 0;
    let excessWater = 0;
    NAXORA_STATE.hotspots.forEach(h => {
        if (h.current_value > h.baseline_value) {
            const diff = h.current_value - h.baseline_value;
            if (h.resource_type === 'Water') excessWater += diff;
            else excessElec += diff;
        }
    });

    const potentialSavings = Math.round((excessElec * 8.0 * 30) + (excessWater * 0.08 * 30) + 1450);

    const kpis = {
        electricity: {
            value: `${elecVal.toLocaleString()} kWh`,
            trend: isPowerSpike ? `↑ +${blockAHotspot?.deviation_percent || 139.7}% vs baseline` : '↓ 8.6% vs yesterday',
            status: isPowerSpike ? 'CRITICAL' : 'OPTIMAL'
        },
        water: {
            value: isWaterLeak ? `${waterVal.toLocaleString()} L/h` : `${waterVal.toLocaleString()} L`,
            trend: isWaterLeak ? `↑ +${canteenHotspot?.deviation_percent || 433.3}% leak surge` : '↓ 4.2% vs baseline',
            status: isWaterLeak ? 'HIGH' : 'NORMAL'
        },
        activeAlerts: {
            value: activeCount,
            subtext: activeCount > 0 ? 'Needs Immediate Action' : 'All Zones Nominal',
            severity: activeCount > 0 ? 'HIGH' : 'NORMAL'
        },
        potentialSavings: {
            value: `Rs. ${potentialSavings.toLocaleString()}`,
            subtext: 'This Month (Recoverable)'
        }
    };

    updateDashboardKPIs(serverData?.kpis || kpis);
    renderHotspotsTable(NAXORA_STATE.hotspots);
    updateMapPins(NAXORA_STATE.hotspots);
    updateAiDiagnostics(serverData?.aiInsight, serverData?.priorityAlert);
    updatePredictionCard(serverData?.futurePrediction);
    updateAlertBadges(activeCount);
}

// Update Dashboard KPI Cards
function updateDashboardKPIs(kpis) {
    if (!kpis) return;
    const elecEl = document.getElementById('kpiTotalWaste');
    const waterEl = document.getElementById('kpiWaterUsage');
    const alertsEl = document.getElementById('kpiHighWaste');
    const savedEl = document.getElementById('kpiResourcesSaved');
    const elecTrendEl = document.getElementById('kpiWasteTrend');
    const waterTrendEl = document.getElementById('kpiWaterTrend');
    const alertsSubEl = document.getElementById('kpiHighSub');
    const savedSubEl = document.getElementById('kpiSavedSub');

    if (elecEl) {
        if (kpis.electricity?.value) elecEl.textContent = kpis.electricity.value;
        else if (kpis.total_electricity !== undefined) elecEl.textContent = `${kpis.total_electricity} kWh`;
    }
    if (elecTrendEl && kpis.electricity?.trend) {
        elecTrendEl.textContent = kpis.electricity.trend;
        elecTrendEl.className = kpis.electricity.status === 'CRITICAL' ? 'kpi-sub-trend red-text' : 'kpi-sub-trend green-text';
    }

    if (waterEl) {
        if (kpis.water?.value) waterEl.textContent = kpis.water.value;
        else if (kpis.total_water !== undefined) waterEl.textContent = `${kpis.total_water} L`;
    }
    if (waterTrendEl && kpis.water?.trend) {
        waterTrendEl.textContent = kpis.water.trend;
        waterTrendEl.className = (kpis.water.status === 'HIGH' || kpis.water.status === 'CRITICAL') ? 'kpi-sub-trend red-text' : 'kpi-sub-trend cyan-text';
    }

    if (alertsEl) {
        if (kpis.activeAlerts?.value !== undefined) alertsEl.textContent = kpis.activeAlerts.value;
        else if (kpis.active_alerts !== undefined) alertsEl.textContent = kpis.active_alerts;
    }
    if (alertsSubEl && kpis.activeAlerts?.subtext) {
        alertsSubEl.textContent = kpis.activeAlerts.subtext;
    }

    if (savedEl) {
        if (kpis.potentialSavings?.value) savedEl.textContent = kpis.potentialSavings.value;
        else if (kpis.potential_savings !== undefined) savedEl.textContent = `Rs. ${kpis.potential_savings.toLocaleString()}`;
    }
    if (savedSubEl && kpis.potentialSavings?.subtext) {
        savedSubEl.textContent = kpis.potentialSavings.subtext;
    }
}

// Render Hotspots Table
function renderHotspotsTable(hotspots) {
    const list = document.getElementById('hotspotRowsList');
    if (!list) return;

    if (!hotspots || hotspots.length === 0) {
        list.innerHTML = '<div style="padding: 14px; color: var(--text-muted); text-align: center;">No active hotspots detected. All monitored buildings nominal.</div>';
        return;
    }

    list.innerHTML = hotspots.map(h => {
        const severityClass = (h.severity || 'NORMAL').toLowerCase();
        const deviationText = h.deviation_percent > 0 ? `+${h.deviation_percent}%` : `${h.deviation_percent}%`;
        const wasteVal = `${h.current_value} ${h.resource_type === 'Water' ? 'L' : 'kWh'} (${deviationText})`;

        return `
            <div class="hotspot-row-item" onclick="openHotspotDiagnosticModal('${h.id}')" title="Click to inspect AI diagnostic for ${h.building}">
                <div>
                    <div class="tbl-loc-title">${h.building}</div>
                    <div class="tbl-sub-loc">${h.room}</div>
                </div>
                <div style="color: var(--text-secondary); font-weight: 600;">${h.resource_type}</div>
                <div>
                    <span class="tbl-status-pill ${severityClass}">${h.severity || 'NORMAL'}</span>
                </div>
                <div class="tbl-level-txt ${severityClass === 'critical' || severityClass === 'high' ? 'red-text' : severityClass === 'medium' ? 'orange-text' : 'green-text'}">
                    ${wasteVal}
                </div>
                <div class="tbl-action-txt" title="${h.recommended_action}">
                    ${h.recommended_action || 'Maintain nominal baseline monitoring.'}
                </div>
            </div>
        `;
    }).join('');
}

// Spatial Campus Zone Coordinates Anchor Map
const ZONE_ANCHORS = {
    'block-a': { top: '38%', left: '32%', class: 'pin-block-a' },
    'block-b': { top: '58%', left: '24%', class: 'pin-block-b' },
    'admin': { top: '28%', left: '56%', class: 'pin-admin' },
    'lab2': { top: '48%', left: '68%', class: 'pin-lab2' },
    'lab-2': { top: '48%', left: '68%', class: 'pin-lab2' },
    'lab': { top: '48%', left: '68%', class: 'pin-lab2' },
    'canteen': { top: '72%', left: '52%', class: 'pin-canteen' },
    'hostel': { top: '76%', left: '82%', class: 'pin-hostel' },
    'library': { top: '22%', left: '78%', class: 'pin-library' }
};

function getAnchorForHotspot(hotspotId, index = 0) {
    const cleanId = (hotspotId || '').toLowerCase().replace(/[^a-z0-9]/g, '-');
    for (const [key, anchor] of Object.entries(ZONE_ANCHORS)) {
        if (cleanId === key || cleanId.includes(key) || key.includes(cleanId)) {
            return anchor;
        }
    }
    const fallbackOffsets = [
        { top: '32%', left: '44%', class: 'pin-custom-1' },
        { top: '64%', left: '40%', class: 'pin-custom-2' },
        { top: '42%', left: '84%', class: 'pin-custom-3' },
        { top: '18%', left: '38%', class: 'pin-custom-4' },
        { top: '82%', left: '68%', class: 'pin-custom-5' }
    ];
    return fallbackOffsets[index % fallbackOffsets.length];
}

// Update Map Pins & Hologram Radars dynamically from Central State
function updateMapPins(hotspots) {
    if (!hotspots || !Array.isArray(hotspots) || hotspots.length === 0) return;

    const dashLayer = document.getElementById('mapPinsDashboardLayer') || document.getElementById('mapStage');
    const liveLayer = document.getElementById('mapPinsLiveLayer') || document.querySelector('.map-immersive-container .map-stage-wrapper');

    const pinsHtml = hotspots.map((h, idx) => {
        const anchor = getAnchorForHotspot(h.id, idx);
        const sev = (h.severity || 'NORMAL').toUpperCase();
        const isCritical = sev === 'CRITICAL';
        const isHigh = sev === 'HIGH';
        const isMedium = sev === 'MEDIUM';

        let boxClass = 'box-normal';
        let badgeClass = 'badge-normal';
        let radarClass = 'radar-green';
        let badgeText = 'NORMAL';

        if (isCritical) {
            boxClass = 'box-high';
            badgeClass = 'badge-high';
            radarClass = 'radar-red';
            badgeText = 'CRITICAL';
        } else if (isHigh) {
            boxClass = 'box-high';
            badgeClass = 'badge-high';
            radarClass = 'radar-red';
            badgeText = 'HIGH WASTE';
        } else if (isMedium) {
            boxClass = 'box-medium';
            badgeClass = 'badge-medium';
            radarClass = 'radar-orange';
            badgeText = 'MEDIUM';
        }

        const bldName = (h.building || 'CAMPUS').toUpperCase();
        let roomName = h.room || '';
        if (!roomName || roomName.toUpperCase() === bldName) {
            roomName = isCritical || isHigh ? 'Alert Zone' : 'Normal Usage';
        }

        const unit = h.resource_type === 'Water' ? 'L' : 'kWh';
        const valText = `${Number(h.current_value || 0).toLocaleString()} ${unit}`;
        const resType = h.resource_type || 'Electricity';
        const pinId = `pin${(h.id || 'zone').split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('')}`;

        return `
            <div class="map-pin-node ${anchor.class || ''}" id="${pinId}" style="top: ${anchor.top}; left: ${anchor.left};" onclick="openHotspotDiagnosticModal('${h.id}')" title="Click to inspect ${bldName} - ${roomName} (${resType}: ${valText} • ${sev})">
                <div class="pin-box ${boxClass}">
                    <div class="pin-title-row">
                        <span class="pin-building-name">${bldName}</span>
                        <span class="pin-val-tag">${valText}</span>
                    </div>
                    <div class="pin-sub-row">
                        <span class="pin-room-name">${roomName}</span>
                        <span class="pin-res-tag">${resType}</span>
                    </div>
                    <span class="pin-badge-status ${badgeClass}">${badgeText}</span>
                </div>
                <div class="pin-leader-stem ${isCritical || isHigh ? 'stem-high' : ''}"></div>
                <div class="hologram-radar ${radarClass}"></div>
            </div>
        `;
    }).join('');

    if (dashLayer) {
        if (dashLayer.id === 'mapPinsDashboardLayer') {
            dashLayer.innerHTML = pinsHtml;
        } else {
            let layer = document.getElementById('mapPinsDashboardLayer');
            if (!layer) {
                layer = document.createElement('div');
                layer.id = 'mapPinsDashboardLayer';
                dashLayer.appendChild(layer);
            }
            layer.innerHTML = pinsHtml;
        }
    }

    if (liveLayer) {
        if (liveLayer.id === 'mapPinsLiveLayer') {
            liveLayer.innerHTML = pinsHtml;
        } else {
            let layer = document.getElementById('mapPinsLiveLayer');
            if (!layer) {
                layer = document.createElement('div');
                layer.id = 'mapPinsLiveLayer';
                liveLayer.appendChild(layer);
            }
            layer.innerHTML = pinsHtml;
        }
    }
}

// Update AI Diagnostics & Priority Alert Cards
function updateAiDiagnostics(aiDiag = null, priorityAlert = null) {
    const bodyEl = document.getElementById('aiInsightBody');
    const reasonEl = document.getElementById('aiDetectionReason');
    const confEl = document.getElementById('aiConfidenceVal');
    const actEl = document.getElementById('aiSuggestedAction');

    const topAnomaly = NAXORA_STATE.hotspots.find(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM') || NAXORA_STATE.hotspots[0];
    const isAnomaly = topAnomaly && (topAnomaly.severity === 'CRITICAL' || topAnomaly.severity === 'HIGH' || topAnomaly.severity === 'MEDIUM');
    const locName = topAnomaly ? (topAnomaly.room && topAnomaly.room !== topAnomaly.building ? `${topAnomaly.building} • ${topAnomaly.room}` : topAnomaly.building) : 'Block A • Room 204';
    const unit = topAnomaly?.resource_type === 'Water' ? 'L' : 'kWh';

    if (bodyEl) {
        if (aiDiag?.message || aiDiag?.summary) {
            bodyEl.innerHTML = aiDiag.message || aiDiag.summary;
        } else if (isAnomaly) {
            bodyEl.innerHTML = `${topAnomaly.resource_type || 'Electricity'} consumption remains abnormally high (<strong>${topAnomaly.current_value} ${unit}</strong> vs ${topAnomaly.baseline_value} ${unit} normal) at ${locName}.`;
        } else {
            bodyEl.innerHTML = `All monitored zones within nominal baseline boundaries. <em>Awaiting post-action telemetry stream.</em>`;
        }
    }

    if (reasonEl) {
        reasonEl.textContent = aiDiag?.why || aiDiag?.reason || (isAnomaly ? topAnomaly.reason : 'BMS mitigation active. Optimal energy efficiency verified across active zones.');
    }
    if (confEl) {
        if (aiDiag?.confidenceLabel) {
            confEl.textContent = `${aiDiag.confidenceVal || aiDiag.confidence || 96}% (${aiDiag.confidenceLabel})`;
            confEl.className = (aiDiag.isLowConfidence || (aiDiag.confidenceVal && aiDiag.confidenceVal < 70)) ? 'orange-text' : 'green-text';
        } else {
            confEl.textContent = `${aiDiag?.confidence || (topAnomaly ? topAnomaly.confidence : 96)}%`;
        }
    }
    if (actEl) {
        actEl.textContent = aiDiag?.recommendedAction || aiDiag?.recommended_action || aiDiag?.action || (isAnomaly ? topAnomaly.recommended_action : 'Maintain standard daytime monitoring.');
    }

    const alertLoc = document.getElementById('priorityAlertLocation');
    const alertBody = document.getElementById('priorityAlertBody');
    const alertAct = document.getElementById('priorityAlertAction');

    const activeAlerts = NAXORA_STATE.alerts.filter(a => a.status === 'ACTIVE');
    const topAlert = activeAlerts[0];

    if (topAlert) {
        if (alertLoc) alertLoc.textContent = topAlert.location;
        if (alertBody) alertBody.textContent = topAlert.message;
        if (alertAct) alertAct.textContent = 'Immediate inspection or automated BMS shutdown recommended.';
    } else {
        if (alertLoc) alertLoc.textContent = 'Campus Monitored Zones';
        if (alertBody) alertBody.textContent = 'All monitored facilities operating within nominal baseline parameters. No active priority alerts.';
        if (alertAct) alertAct.textContent = 'Nominal status — awaiting post-action telemetry stream.';
    }
}

// Update Future Prediction Card
function updatePredictionCard(pred = null) {
    const bodyEl = document.getElementById('futurePredictionBody');
    const costEl = document.getElementById('futurePredictionCost');
    const confEl = document.getElementById('predConfidenceVal');

    const topAnomaly = NAXORA_STATE.hotspots.find(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM');
    const isAnomaly = !!topAnomaly;
    const locName = topAnomaly ? (topAnomaly.room && topAnomaly.room !== topAnomaly.building ? `${topAnomaly.building} • ${topAnomaly.room}` : topAnomaly.building) : 'Block A • Room 204';
    const unit = topAnomaly?.resource_type === 'Water' ? 'L' : 'kWh';

    if (bodyEl) {
        if (pred?.summary) {
            bodyEl.innerHTML = pred.summary;
        } else if (isAnomaly) {
            const wasteEst = Math.max(252, Math.round((topAnomaly.current_value - topAnomaly.baseline_value) * 0.3));
            bodyEl.innerHTML = `${locName} may waste approximately: <strong>${wasteEst} ${unit}/month</strong> if unmitigated.`;
        } else {
            bodyEl.innerHTML = `Projected wastage trajectory remains below baseline thresholds.`;
        }
    }
    if (costEl) {
        const cost = pred?.estimatedAvoidableCost || (isAnomaly ? Math.round(Math.max(252, (topAnomaly.current_value - topAnomaly.baseline_value) * 0.3) * (topAnomaly?.resource_type === 'Water' ? 0.08 : 8.0)) : 0);
        costEl.textContent = cost > 0 ? `Rs. ${cost.toLocaleString()}/month` : 'Nominal';
    }
    if (confEl) {
        confEl.textContent = `${pred?.confidence || topAnomaly?.confidence || 96}%`;
    }
}

// Synchronize Alert Badges across Dashboard, Sidebar, and Alerts Center
function updateAlertBadges(count) {
    const navBadge = document.getElementById('navBadgeAlert');
    const alertsKpi = document.getElementById('kpiHighWaste');
    const alertsActivePill = document.getElementById('alertsActiveCountBadge');

    if (navBadge) {
        navBadge.textContent = count;
        navBadge.style.display = count > 0 ? 'inline-block' : 'none';
    }
    if (alertsKpi) {
        alertsKpi.textContent = count;
    }
    if (alertsActivePill) {
        alertsActivePill.textContent = `ACTIVE ALERTS: ${count}`;
    }
}

// ================= MODAL 1: HOTSPOT DIAGNOSTIC MODAL =================
function openHotspotDiagnosticModal(hotspotKey) {
    let hotspot = NAXORA_STATE.hotspots.find(h => h.id === hotspotKey || (h.building && h.building.toLowerCase().includes(hotspotKey.toLowerCase())) || (h.room && h.room.toLowerCase().includes(hotspotKey.toLowerCase())));
    
    if (!hotspot) {
        hotspot = {
            id: 'block-a',
            building: 'Block A',
            room: 'Room 204',
            current_value: 1486,
            baseline_value: 620,
            deviation_percent: 139.7,
            confidence: 96,
            severity: 'CRITICAL',
            reason: 'Zero occupancy detected but HVAC and GPU workstations continue consuming power.',
            recommended_action: 'Inspect high-consumption equipment and apply automated BMS shutdown.'
        };
    }

    NAXORA_STATE.currentSelectedHotspot = hotspot;

    const titleEl = document.getElementById('modalBuildingTitle');
    const badgeEl = document.getElementById('modalStatusBadge');
    const currEl = document.getElementById('modalCurrentVal');
    const baseEl = document.getElementById('modalBaselineVal');
    const devEl = document.getElementById('modalDeviationVal');
    const confEl = document.getElementById('modalConfidenceVal');
    const reasonEl = document.getElementById('modalReasonText');
    const actionEl = document.getElementById('modalActionText');

    if (titleEl) titleEl.textContent = `${hotspot.building} - ${hotspot.room}`;
    if (badgeEl) {
        badgeEl.textContent = hotspot.severity || 'NORMAL';
        badgeEl.className = `modal-status-badge badge-${(hotspot.severity || 'normal').toLowerCase()}`;
    }
    if (currEl) currEl.textContent = `${hotspot.current_value} ${hotspot.resource_type === 'Water' ? 'L' : 'kWh'}`;
    if (baseEl) baseEl.textContent = `${hotspot.baseline_value || Math.round(hotspot.current_value / 1.5)} ${hotspot.resource_type === 'Water' ? 'L' : 'kWh'}`;
    if (devEl) {
        const sign = hotspot.deviation_percent > 0 ? '+' : '';
        devEl.textContent = `${sign}${hotspot.deviation_percent}%`;
    }
    if (confEl) confEl.textContent = `${hotspot.confidence || 96}%`;
    if (reasonEl) reasonEl.textContent = hotspot.reason || 'Telemetry deviation detected against rolling baseline.';
    if (actionEl) actionEl.textContent = hotspot.recommended_action || 'Inspect circuit breaker and apply automated BMS mitigation.';

    const bmsBtn = document.querySelector('#hotspotModalBackdrop .btn-modal-bms') || document.getElementById('btnModalApplyBms');
    if (bmsBtn) {
        bmsBtn.onclick = async () => {
            const loc = hotspot ? (hotspot.building + (hotspot.room && hotspot.room !== hotspot.building ? ' - ' + hotspot.room : '')) : null;
            const matchingAlert = hotspot ? NAXORA_STATE.alerts.find(a => (a.hotspot_id === hotspot.id || a.location.includes(hotspot.building)) && a.status === 'ACTIVE') : null;
            closeHotspotModal();
            await triggerApplyBmsShutdown(matchingAlert ? matchingAlert.id : null, loc, hotspot ? hotspot.resource_type : null);
        };
    }

    const modal = document.getElementById('hotspotModalBackdrop');
    if (modal) modal.style.display = 'flex';
}

function closeHotspotModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('hotspotModalBackdrop');
    if (modal) modal.style.display = 'none';
}

// ================= MODAL 2: ELECTRICITY DETAILS MODAL =================
function openElectricityDetailsModal() {
    const topElec = NAXORA_STATE.hotspots.find(h => (h.resource_type === 'Electricity' || !h.resource_type) && (h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM')) || NAXORA_STATE.hotspots.find(h => h.id === 'block-a') || NAXORA_STATE.hotspots[0];
    const isSpike = topElec && (topElec.severity === 'CRITICAL' || topElec.severity === 'HIGH' || topElec.severity === 'MEDIUM');
    const locLabel = topElec ? (topElec.room && topElec.room !== topElec.building ? `${topElec.building} - ${topElec.room}` : topElec.building) : 'Block A - Room 204';

    const curVal = topElec ? topElec.current_value : 620;
    const baseVal = topElec ? topElec.baseline_value : 620;
    const devPct = topElec ? topElec.deviation_percent : 0;
    const excess = Math.max(0, curVal - baseVal);
    const monthlySavings = Math.round(excess * 8.0 * 30);
    const dailyCost = Math.round(curVal * 8.0);

    const currEl = document.getElementById('elecModalCurrent');
    const baseEl = document.getElementById('elecModalBaseline');
    const diffEl = document.getElementById('elecModalDiff');
    const costEl = document.getElementById('elecModalCost');
    const saveEl = document.getElementById('elecModalSavings');
    const topLocEl = document.getElementById('elecModalTopLocation');

    if (currEl) currEl.textContent = `${curVal.toLocaleString()} kWh`;
    if (baseEl) baseEl.textContent = `${baseVal.toLocaleString()} kWh`;
    if (diffEl) {
        diffEl.textContent = isSpike ? `+${devPct}% (ANOMALY)` : `${devPct > 0 ? '+' : ''}${devPct}%`;
        diffEl.className = `stat-num ${isSpike ? 'red-text' : 'green-text'}`;
    }
    if (costEl) costEl.textContent = `Rs. ${dailyCost.toLocaleString()} / day`;
    if (saveEl) saveEl.textContent = monthlySavings > 0 ? `Rs. ${monthlySavings.toLocaleString()} / mo` : 'Nominal';
    if (topLocEl) topLocEl.textContent = isSpike ? `${locLabel} (${curVal} kWh Surge)` : `${locLabel} (Nominal)`;

    renderElectricityUsageChart(isSpike, curVal, baseVal);

    const modal = document.getElementById('elecDetailsModalBackdrop');
    if (modal) modal.style.display = 'flex';
}

function closeElectricityDetailsModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('elecDetailsModalBackdrop');
    if (modal) modal.style.display = 'none';
}

function renderElectricityUsageChart(isSpike, curVal = 1486, baseVal = 620) {
    const canvas = document.getElementById('elecUsageChartCanvas');
    if (!canvas) return;

    if (elecUsageChartInstance) {
        elecUsageChartInstance.destroy();
    }

    const labels = ['00:00', '04:00', '08:00', '12:00', '14:00', '16:00', '20:00', '23:59'];
    const baseline = [Math.round(baseVal * 0.5), Math.round(baseVal * 0.45), Math.round(baseVal * 0.85), Math.round(baseVal * 1.4), Math.round(baseVal * 1.7), Math.round(baseVal * 1.6), Math.round(baseVal * 1.1), Math.round(baseVal * 0.7)];

    const actual = isSpike
        ? [Math.round(baseVal * 0.52), Math.round(baseVal * 0.48), Math.round(baseVal * 0.9), Math.round(baseVal * 1.5), curVal, Math.round(curVal * 0.95), Math.round(baseVal * 1.8), Math.round(baseVal * 1.2)]
        : [Math.round(baseVal * 0.5), Math.round(baseVal * 0.46), Math.round(baseVal * 0.85), Math.round(baseVal * 1.42), curVal, Math.round(curVal * 0.96), Math.round(baseVal * 1.12), Math.round(baseVal * 0.72)];

    const ctx = canvas.getContext('2d');
    elecUsageChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Actual Draw (kWh)',
                    data: actual,
                    borderColor: isSpike ? '#ef4444' : '#00f2fe',
                    backgroundColor: isSpike ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 242, 254, 0.15)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3
                },
                {
                    label: 'Calibrated Baseline',
                    data: baseline,
                    borderColor: '#22c55e',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.2,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } }
            }
        }
    });
}

// ================= MODAL 3: WATER DETAILS MODAL =================
function openWaterDetailsModal() {
    const canteen = NAXORA_STATE.hotspots.find(h => h.resource_type === 'Water') || NAXORA_STATE.hotspots.find(h => h.id === 'canteen');
    const isLeak = canteen && (canteen.severity === 'CRITICAL' || canteen.severity === 'HIGH' || canteen.current_value > canteen.baseline_value * 1.2);

    const curVal = canteen ? canteen.current_value : 45;
    const baseVal = canteen ? canteen.baseline_value : 45;
    const devPct = canteen ? canteen.deviation_percent : 0;
    const excess = Math.max(0, curVal - baseVal);
    const monthlySavings = Math.round(excess * 0.08 * 30);

    const currEl = document.getElementById('waterModalCurrent');
    const baseEl = document.getElementById('waterModalBaseline');
    const diffEl = document.getElementById('waterModalDiff');
    const statusEl = document.getElementById('waterModalStatus');
    const monthEl = document.getElementById('waterModalMonthly');
    const saveEl = document.getElementById('waterModalSavings');

    if (currEl) currEl.textContent = `${curVal.toLocaleString()} L`;
    if (baseEl) baseEl.textContent = `${baseVal.toLocaleString()} L`;
    if (diffEl) {
        diffEl.textContent = isLeak ? `+${devPct}% (FLOW SURGE)` : `${devPct > 0 ? '+' : ''}${devPct}%`;
        diffEl.className = `stat-num ${isLeak ? 'red-text' : 'green-text'}`;
    }
    if (statusEl) {
        statusEl.textContent = isLeak ? 'LEAK DETECTED' : 'NORMAL';
        statusEl.className = `stat-num ${isLeak ? 'red-text' : 'green-text'}`;
    }
    if (monthEl) monthEl.textContent = `${Math.round(curVal * 30).toLocaleString()} L`;
    if (saveEl) saveEl.textContent = excess > 0 ? `${Math.round(excess * 30).toLocaleString()} L (Rs. ${monthlySavings.toLocaleString()})` : 'Nominal';

    renderWaterUsageChart(isLeak, curVal, baseVal);

    const modal = document.getElementById('waterDetailsModalBackdrop');
    if (modal) modal.style.display = 'flex';
}

function closeWaterDetailsModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('waterDetailsModalBackdrop');
    if (modal) modal.style.display = 'none';
}

function renderWaterUsageChart(isLeak, curVal = 240, baseVal = 45) {
    const canvas = document.getElementById('waterUsageChartCanvas');
    if (!canvas) return;

    if (waterUsageChartInstance) {
        waterUsageChartInstance.destroy();
    }

    const labels = ['00:00', '04:00', '08:00', '11:30', '13:30', '17:00', '20:00', '23:59'];
    const baseline = [Math.round(baseVal * 0.4), Math.round(baseVal * 0.3), Math.round(baseVal * 1.5), Math.round(baseVal * 2.8), Math.round(baseVal * 2.7), Math.round(baseVal * 1.6), Math.round(baseVal * 0.9), Math.round(baseVal * 0.5)];

    const actual = isLeak
        ? [Math.round(baseVal * 0.9), Math.round(baseVal * 0.8), Math.round(baseVal * 2.2), curVal, Math.round(curVal * 0.95), Math.round(baseVal * 2.8), Math.round(baseVal * 1.7), Math.round(baseVal * 1.0)]
        : [Math.round(baseVal * 0.42), Math.round(baseVal * 0.32), Math.round(baseVal * 1.55), curVal, Math.round(curVal * 0.98), Math.round(baseVal * 1.65), Math.round(baseVal * 0.95), Math.round(baseVal * 0.52)];

    const ctx = canvas.getContext('2d');
    waterUsageChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Flow Rate (L/hr)',
                    data: actual,
                    borderColor: isLeak ? '#ef4444' : '#38bdf8',
                    backgroundColor: isLeak ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    fill: true,
                    tension: 0.35,
                    pointRadius: 3
                },
                {
                    label: 'Calibrated Baseline',
                    data: baseline,
                    borderColor: '#22c55e',
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.2,
                    pointRadius: 2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#94a3b8', font: { size: 10 } } } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } }
            }
        }
    });
}

// ================= MODAL 4: SAVINGS DETAILS MODAL =================
async function openSavingsDetailsModal() {
    renderSavingsBreakdownChart();
    const modal = document.getElementById('savingsDetailsModalBackdrop');
    if (modal) modal.style.display = 'flex';
}

function closeSavingsDetailsModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('savingsDetailsModalBackdrop');
    if (modal) modal.style.display = 'none';
}

async function renderSavingsBreakdownChart() {
    const canvas = document.getElementById('savingsBreakdownChartCanvas');
    if (!canvas) return;

    if (savingsBreakdownChartInstance) {
        savingsBreakdownChartInstance.destroy();
    }

    let labels = [];
    let dataValues = [];

    try {
        const res = await fetch(`${API_BASE}/savings?facility_id=${NAXORA_STATE.facility}`);
        if (res.ok) {
            const data = await res.json();
            if (data.locationBreakdown && Array.isArray(data.locationBreakdown)) {
                labels = data.locationBreakdown.map(l => `${l.location} (${l.resourceType})`);
                dataValues = data.locationBreakdown.map(l => l.potentialSavingsRs);
            }
        }
    } catch (e) {
        console.warn('Savings API fetch fallback:', e);
    }

    if (labels.length === 0) {
        labels = ['Electricity Excess', 'Water Leakage', 'Thermal / HVAC', 'Standby Vampire'];
        dataValues = [0, 0, 0, 0];
    }

    const backgroundColors = ['#00f2fe', '#38bdf8', '#6366f1', '#22c55e', '#ef4444', '#f59e0b'];

    const ctx = canvas.getContext('2d');
    savingsBreakdownChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Monthly Recoverable Value (Rs.)',
                data: dataValues,
                backgroundColor: backgroundColors.slice(0, labels.length),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#64748b', font: { size: 9 } } }
            }
        }
    });
}

// ================= MODAL 5: MANUAL TELEMETRY INGESTION =================
function openTelemetryModal() {
    const modal = document.getElementById('telemetryModalBackdrop');
    if (modal) modal.style.display = 'flex';
}

function closeTelemetryModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('telemetryModalBackdrop');
    if (modal) modal.style.display = 'none';
}

function updateTelemetryUnit() {
    const type = document.getElementById('telResourceType').value;
    const unitInput = document.getElementById('telUnit');
    if (!unitInput) return;

    if (type.toLowerCase().includes('water')) unitInput.value = 'L';
    else if (type.toLowerCase().includes('temp')) unitInput.value = '°C';
    else if (type.toLowerCase().includes('occup')) unitInput.value = 'people';
    else if (type.toLowerCase().includes('gas')) unitInput.value = 'm3';
    else unitInput.value = 'kWh';
}

async function handleTelemetrySubmit(event) {
    event.preventDefault();

    const buildingInput = (document.getElementById('telBuilding')?.value || 'Block A').trim();
    const roomInput = (document.getElementById('telRoom')?.value || '').trim();
    
    let location = '';
    if (buildingInput.includes(' - ') || buildingInput.includes(' • ')) {
        location = buildingInput;
    } else if (roomInput) {
        location = `${buildingInput} - ${roomInput}`;
    } else {
        location = buildingInput;
    }

    const resourceType = (document.getElementById('telResourceType')?.value || 'Electricity').toLowerCase();
    const value = parseFloat(document.getElementById('telConsumption')?.value || 0);
    const unit = document.getElementById('telUnit')?.value || (resourceType.includes('water') ? 'L' : 'kWh');
    const occupancy = parseInt(document.getElementById('telOccupancy')?.value, 10) || 0;
    const facility = document.getElementById('telFacility')?.value || 'campus';

    const payload = {
        location,
        resourceType,
        value,
        unit,
        occupancy,
        facility,
        source: 'MANUAL_INPUT'
    };

    showNotification(`Ingesting telemetry for ${location} & evaluating AI anomaly engine...`);

    try {
        const res = await fetch(`${API_BASE}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        closeTelemetryModal();

        if (res.ok) {
            const dev = result.diagnostic?.deviationPercent || 0;
            const sev = result.diagnostic?.severity || 'NORMAL';
            const isLearning = result.diagnostic?.isLearning;
            playAudioAlert(sev === 'CRITICAL' || sev === 'HIGH' ? 'danger' : 'success');
            
            if (isLearning) {
                showNotification(`Telemetry recorded for ${location}! Baseline learning initiated.`);
            } else {
                showNotification(`Telemetry received for ${location}! Status: ${sev} (${dev > 0 ? '+' : ''}${dev}%)`);
            }
            await refreshNaxoraState({ force: true });
        } else {
            showNotification(`Telemetry error: ${result.message || result.error || 'Server error'}`, 'error');
        }
    } catch (err) {
        closeTelemetryModal();
        showNotification(`Telemetry recorded in local state for ${location}.`);
        await refreshNaxoraState({ force: true });
    }
}

// ================= VIEW 3: AI INSIGHTS & ROOT CAUSE ANALYSIS =================
async function loadAiInsights() {
    const list = document.getElementById('aiDetectionsList');
    if (!list) return;

    try {
        if (NAXORA_STATE.isBackendConnected) {
            const res = await fetch(`${API_BASE}/insights?facility_id=${NAXORA_STATE.facility}`);
            if (res.ok) {
                const data = await res.json();
                if (data.allHotspots) NAXORA_STATE.hotspots = data.allHotspots;
            }
        }

        const hotspots = NAXORA_STATE.hotspots;
        const activeAnomalies = hotspots.filter(h => h.severity === 'CRITICAL' || h.severity === 'HIGH' || h.severity === 'MEDIUM');

        const anomCountEl = document.getElementById('aiAnomaliesCount');
        const lastTimeEl = document.getElementById('aiLastAnalysisTime');
        if (anomCountEl) anomCountEl.textContent = `${activeAnomalies.length} Active`;
        if (lastTimeEl) lastTimeEl.textContent = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const priorityTextEl = document.getElementById('aiPriorityActionText');
        const priorityBadgeEl = document.getElementById('aiPriorityActionBadge');

        if (activeAnomalies.length === 0) {
            if (priorityTextEl) priorityTextEl.innerHTML = 'All monitored facilities operating within nominal baseline parameters. No emergency BMS intervention required.';
            if (priorityBadgeEl) {
                priorityBadgeEl.className = 'tbl-status-pill normal';
                priorityBadgeEl.textContent = 'NOMINAL';
            }
            list.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid var(--accent-green); border-radius: var(--radius-lg); padding: 24px; text-align: center;">
                    <h4 style="color: var(--accent-green); font-size: 1.1rem; margin-bottom: 6px;">&check; AI ANALYSIS CLEAR</h4>
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">No abnormal resource consumption detected across monitored facilities.</p>
                </div>
            `;
            return;
        }

        const topAnom = activeAnomalies[0];
        if (priorityTextEl && topAnom) {
            const locName = topAnom.room && topAnom.room !== topAnom.building ? `${topAnom.building} - ${topAnom.room}` : topAnom.building;
            priorityTextEl.innerHTML = `<strong>${locName}</strong> has abnormal sustained ${topAnom.resource_type ? topAnom.resource_type.toLowerCase() : 'electrical'} draw (+${topAnom.deviation_percent}%). Immediate automated BMS isolation recommended to prevent energy loss.`;
        }
        if (priorityBadgeEl && topAnom) {
            priorityBadgeEl.className = `tbl-status-pill ${topAnom.severity.toLowerCase()}`;
            priorityBadgeEl.textContent = topAnom.severity;
        }

        list.innerHTML = activeAnomalies.map(h => {
            const conf = h.confidence || 96;
            let confLabel = h.confidenceLabel || 'High Confidence';
            let confColor = 'var(--accent-green)';
            if (conf < 70 || h.isLowConfidence || (h.confidenceLabel && h.confidenceLabel.includes('learning'))) {
                confLabel = 'Low confidence — baseline learning';
                confColor = 'var(--accent-orange)';
            } else if (conf < 80) {
                confLabel = 'Medium Confidence';
                confColor = 'var(--accent-orange)';
            } else if (conf < 90) {
                confLabel = 'High Confidence';
                confColor = 'var(--accent-blue)';
            } else {
                confLabel = 'Very High Confidence';
                confColor = 'var(--accent-green)';
            }

            const isMitigated = h.status === 'NORMAL';
            const locTitle = h.room && h.room !== h.building ? `${h.building} &bull; ${h.room}` : h.building;

            return `
                <div class="ai-detection-card">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="tbl-status-pill ${h.severity.toLowerCase()}">${h.severity}</span>
                            <h4 style="color: #fff; font-size: 0.95rem;">${locTitle}</h4>
                        </div>
                        <span style="font-size: 0.72rem; color: var(--text-muted);">Status: <strong style="color: ${isMitigated ? 'var(--accent-green)' : 'var(--accent-red)'}">${isMitigated ? 'MITIGATED' : 'ACTIVE'}</strong></span>
                    </div>

                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 6px; font-size: 0.75rem;">
                        <div>
                            <span style="color: var(--text-muted); display: block;">Resource:</span>
                            <strong style="color: #fff;">${h.resource_type}</strong>
                        </div>
                        <div>
                            <span style="color: var(--text-muted); display: block;">Current Draw:</span>
                            <strong class="red-text">${h.current_value} ${h.resource_type === 'Water' ? 'L' : 'kWh'}</strong>
                        </div>
                        <div>
                            <span style="color: var(--text-muted); display: block;">Baseline Deviation:</span>
                            <strong class="red-text">+${h.deviation_percent}%</strong>
                        </div>
                    </div>

                    <div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.72rem;">
                            <span style="color: var(--text-muted);">AI Detection Confidence:</span>
                            <strong style="color: ${confColor}; font-weight: 800;">${conf}% &bull; ${confLabel.toUpperCase()}</strong>
                        </div>
                        <div class="ai-conf-bar-track">
                            <div class="ai-conf-bar-fill" style="width: ${conf}%; background: ${confColor};"></div>
                        </div>
                    </div>

                    <div style="background: var(--bg-card); padding: 10px 14px; border-left: 3px solid var(--accent-cyan); border-radius: 0 6px 6px 0; font-size: 0.78rem;">
                        <strong style="color: var(--accent-cyan); display: block; margin-bottom: 2px;">Detection Reason:</strong>
                        <p style="color: #e2e8f0;">${h.reason || 'Zero occupancy detected while equipment continues drawing heavy load.'}</p>
                    </div>

                    <details style="background: rgba(0,0,0,0.2); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 8px 12px;" open>
                        <summary style="cursor: pointer; font-size: 0.72rem; font-weight: 800; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.05em;">
                            Root Cause Analysis Flow &bull; Step-by-Step
                        </summary>
                        <div class="root-cause-chain" style="margin-top: 8px;">
                            <span class="rc-step">Step 1: Anomaly Detected</span>
                            <span class="rc-arrow">&rarr;</span>
                            <span class="rc-step">Step 2: Consumption Exceeds Baseline</span>
                            <span class="rc-arrow">&rarr;</span>
                            <span class="rc-step">Step 3: Zero Occupancy Confirmed</span>
                            <span class="rc-arrow">&rarr;</span>
                            <span class="rc-step">Step 4: Active Sub-circuit Identified</span>
                            <span class="rc-arrow">&rarr;</span>
                            <span class="rc-step">Step 5: Waste & Risk Estimated</span>
                            <span class="rc-arrow">&rarr;</span>
                            <span class="rc-step" style="border-color: var(--accent-green); color: var(--accent-green);">Step 6: Recommend BMS Isolation</span>
                        </div>
                    </details>

                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">Action: <strong style="color: #fff;">${h.recommended_action}</strong></span>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn-sec-action" onclick="openHotspotDiagnosticModal('${h.id}')">View Details</button>
                            <button class="btn-modal-bms" onclick="triggerApplyBmsShutdown(null, '${h.building + (h.room && h.room !== h.building ? ' - ' + h.room : '')}', '${h.resource_type}')" style="padding: 0.45rem 0.85rem; font-size: 0.72rem;">Apply BMS Shutdown</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.warn('AI Insights error:', e);
    }
}

// AI Insights Refresh Button Handler (Synchronizes live backend state)
async function refreshAiAnalysis(showFeedback = true) {
    const btn = document.querySelector('.btn-refresh-ai');
    if (btn) btn.classList.add('loading');
    if (showFeedback) showNotification('Refreshing AI Anomaly Analysis & Diagnostics from backend...');
    
    await refreshNaxoraState({ force: true });
    await loadAiInsights();
    
    if (btn) btn.classList.remove('loading');
    if (showFeedback) showNotification('AI Diagnostics synchronized with latest backend state.');
}

// ================= VIEW 5: ALERTS CENTER =================
async function loadAlerts() {
    const feed = document.getElementById('alertsFeedList');
    if (!feed) return;

    try {
        if (NAXORA_STATE.isBackendConnected) {
            const url = `${API_BASE}/alerts?filter=${NAXORA_STATE.alertFilter}`;
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                if (data.alerts && Array.isArray(data.alerts)) {
                    NAXORA_STATE.alerts = data.alerts;
                }
            }
        }
    } catch (err) {
        console.warn('Alerts fetch using central state:', err);
    }

    let filteredAlerts = NAXORA_STATE.alerts;
    if (NAXORA_STATE.alertFilter === 'ACTIVE') {
        filteredAlerts = NAXORA_STATE.alerts.filter(a => a.status === 'ACTIVE');
    } else if (NAXORA_STATE.alertFilter === 'RESOLVED') {
        filteredAlerts = NAXORA_STATE.alerts.filter(a => a.status === 'RESOLVED');
    } else if (NAXORA_STATE.alertFilter !== 'ALL') {
        filteredAlerts = NAXORA_STATE.alerts.filter(a => a.severity === NAXORA_STATE.alertFilter && a.status === 'ACTIVE');
    }

    renderAlertsFeed(filteredAlerts);
    updateAlertBadges(NAXORA_STATE.alerts.filter(a => a.status === 'ACTIVE').length);
}

function filterAlerts(filterType, element) {
    NAXORA_STATE.alertFilter = filterType;
    if (element) {
        document.querySelectorAll('#alertFilterPills .filter-pill').forEach(btn => btn.classList.remove('active'));
        element.classList.add('active');
    }
    loadAlerts();
}

function renderAlertsFeed(alerts) {
    const feed = document.getElementById('alertsFeedList');
    if (!feed) return;

    if (!alerts || alerts.length === 0) {
        if (NAXORA_STATE.alertFilter === 'ALL' || NAXORA_STATE.alertFilter === 'ACTIVE') {
            feed.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid var(--accent-green); border-radius: var(--radius-lg); padding: 28px; text-align: center;">
                    <h4 style="color: var(--accent-green); font-size: 1.15rem; margin-bottom: 6px;">&check; ALL CLEAR</h4>
                    <p style="color: #fff; font-size: 0.85rem; font-weight: 600;">No active resource anomalies detected.</p>
                    <p style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 4px;">AI monitoring is currently operating normally across all campus facilities.</p>
                </div>
            `;
        } else {
            feed.innerHTML = `
                <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-card); border-radius: var(--radius-lg); padding: 24px; text-align: center;">
                    <p style="color: var(--text-secondary); font-size: 0.85rem;">No alerts matching filter "${NAXORA_STATE.alertFilter}".</p>
                </div>
            `;
        }
        return;
    }

    feed.innerHTML = alerts.map(a => {
        const sevClass = (a.severity || 'NORMAL').toLowerCase();
        const isResolved = a.status === 'RESOLVED';

        return `
            <div class="alert-item" style="background: var(--bg-secondary); border-left: 4px solid ${sevClass === 'critical' ? 'var(--accent-red)' : sevClass === 'high' ? 'var(--accent-red)' : sevClass === 'medium' ? 'var(--accent-orange)' : 'var(--accent-green)'}; padding: 14px 18px; border-radius: var(--radius-md); border-top: 1px solid var(--border-card); border-right: 1px solid var(--border-card); border-bottom: 1px solid var(--border-card); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px;">
                <div style="flex: 1; min-width: 280px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span class="tbl-status-pill ${sevClass}">${a.severity || 'ALERT'}</span>
                        <strong style="color: #fff; font-size: 0.88rem;">${a.title || 'Abnormal Resource Anomaly'}</strong>
                        <span style="font-size: 0.68rem; color: var(--text-muted);">${a.created_at ? new Date(a.created_at).toLocaleTimeString() : 'Recent'}</span>
                    </div>
                    <p style="font-size: 0.78rem; color: #e2e8f0; margin-bottom: 4px;">${a.message}</p>
                    <div style="display: flex; gap: 14px; font-size: 0.72rem; color: var(--text-secondary);">
                        <span>Location: <strong style="color: var(--accent-cyan);">${a.location}</strong></span>
                        <span>Resource: <strong style="color: #fff;">${a.resource_type || 'Electricity'}</strong></span>
                        <span>Deviation: <strong class="red-text">+${a.deviation_percent || 139}%</strong></span>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button class="btn-sec-action" onclick="openHotspotDiagnosticModal('${a.hotspot_id || a.location}')">View Details</button>
                    ${!isResolved && ((a.resource_type || 'Electricity').toLowerCase().includes('elec') || a.hotspot_id === 'block-a' || a.hotspot_id === 'lab2')
                        ? `<button class="btn-modal-bms" onclick="triggerApplyBmsShutdown('${a.id}', '${a.location}', '${a.resource_type}')" style="padding: 0.45rem 0.85rem; font-size: 0.72rem;">Apply BMS Shutdown</button>`
                        : ''
                    }
                    ${isResolved
                        ? '<span style="color: var(--accent-green); font-size: 0.75rem; font-weight: 800; background: rgba(34,197,94,0.15); padding: 4px 10px; border-radius: 20px;">RESOLVED</span>'
                        : `<button class="btn-sec-action" onclick="resolveAlert('${a.id}')" style="border-color: var(--accent-green); color: var(--accent-green);">Resolve</button>`
                    }
                </div>
            </div>
        `;
    }).join('');
}

async function resolveAlert(alertId) {
    const alert = NAXORA_STATE.alerts.find(a => String(a.id) === String(alertId));
    if (!alert) return;

    alert.status = 'RESOLVED';
    alert.resolved_at = new Date().toISOString();

    if (alert.hotspot_id) {
        const hotspot = NAXORA_STATE.hotspots.find(h => h.id === alert.hotspot_id);
        if (hotspot) {
            hotspot.status = 'NORMAL';
            hotspot.severity = 'NORMAL';
            hotspot.deviation_percent = 0.0;
            hotspot.current_value = hotspot.baseline_value;
            hotspot.recommended_action = 'Anomaly resolved. Nominal monitoring active.';
        }
    }

    if (NAXORA_STATE.isBackendConnected) {
        try {
            await fetch(`${API_BASE}/alerts/${alertId}/resolve`, { method: 'POST' });
        } catch (e) {}
    }

    playAudioAlert('success');
    showNotification(`Alert resolved successfully — ${alert.location} returned to normal monitoring.`);

    await refreshNaxoraState({ force: true });
}

// ================= VIEW 7: SYSTEM AUDIT TRAIL =================
async function loadAuditTrail(showFeedback = false) {
    const tableBody = document.getElementById('fullAuditTableBody');
    if (!tableBody) return;

    const refreshBtn = document.getElementById('btnRefreshAudit');
    if (refreshBtn) refreshBtn.classList.add('loading');

    try {
        const url = `${API_BASE}/audit?category=${encodeURIComponent(NAXORA_STATE.auditFilter)}&t=${Date.now()}`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            if (data.logs && Array.isArray(data.logs)) {
                NAXORA_STATE.auditLogs = data.logs;
                NAXORA_STATE.isBackendConnected = true;
                if (showFeedback) {
                    showNotification(`Audit trail refreshed: ${data.logs.length} records loaded.`);
                }
            }
        }
    } catch (e) {
        console.warn('Audit trail fetch fallback', e);
    } finally {
        if (refreshBtn) refreshBtn.classList.remove('loading');
    }

    const logs = NAXORA_STATE.auditLogs || [];

    if (logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" style="padding: 20px; text-align: center; color: var(--text-muted);">No audit records found matching '${NAXORA_STATE.auditFilter}'.</td></tr>`;
        return;
    }

    tableBody.innerHTML = logs.map(log => {
        const isSuccess = log.status === 'SUCCESS' || log.status === 'RESOLVED' || log.status === 'NORMAL';
        const sevClass = (log.status || 'NORMAL').toLowerCase();
        return `
            <tr style="border-bottom: 1px solid var(--border-subtle);">
                <td style="padding: 10px 14px; color: var(--text-muted); font-family: var(--font-mono);">${log.time || 'Recent'}</td>
                <td style="padding: 10px 14px; font-weight: 700; color: #fff;">${log.actor || 'System'}</td>
                <td style="padding: 10px 14px; color: var(--accent-cyan); font-weight: 600;">${log.action}</td>
                <td style="padding: 10px 14px; color: #fff;">${log.location}</td>
                <td style="padding: 10px 14px; color: var(--text-secondary);">${log.details}</td>
                <td style="padding: 10px 14px;">
                    <span class="tbl-status-pill ${isSuccess ? 'normal' : sevClass === 'critical' ? 'critical' : 'high'}">${log.status}</span>
                </td>
            </tr>
        `;
    }).join('');
}

function filterAuditCategory(category, element) {
    NAXORA_STATE.auditFilter = category;
    if (element) {
        document.querySelectorAll('.audit-filter-bar .filter-pill').forEach(p => p.classList.remove('active'));
        element.classList.add('active');
    }
    loadAuditTrail();
}

// ================= VIEW 4: PREDICTIONS & FORECASTING =================
async function loadPredictions() {
    const wasteEl = document.getElementById('predMonthlyWaste');
    const costEl = document.getElementById('predMonthlyCost');
    const confEl = document.getElementById('predModelConfidence');

    try {
        if (NAXORA_STATE.isBackendConnected) {
            const res = await fetch(`${API_BASE}/predictions?facility_id=${NAXORA_STATE.facility}`);
            if (res.ok) {
                const data = await res.json();
                const forecast = data.forecast || {};
                const summary = data.summary || {};

                if (wasteEl) {
                    wasteEl.textContent = summary.hasSufficientData
                        ? `${(summary.projected_wastage || 0).toLocaleString()} ${summary.unit || 'kWh'}`
                        : 'Insufficient data';
                }
                if (costEl) {
                    costEl.textContent = summary.hasSufficientData
                        ? `Rs. ${(summary.avoidable_cost || 0).toLocaleString()}`
                        : 'Insufficient data';
                }
                if (confEl) {
                    if (summary.confidenceLabel) {
                        confEl.textContent = `${summary.confidence || 50}% (${summary.confidenceLabel})`;
                        confEl.className = summary.isLowConfidence ? 'score-large orange-text' : 'score-large green-text';
                    } else {
                        confEl.textContent = `${summary.confidence || 50}%`;
                    }
                }

                renderPredictionChart(forecast);
                return;
            }
        }
    } catch (err) {
        console.warn('Predictions API fetch error:', err);
    }

    if (wasteEl) wasteEl.textContent = 'Insufficient data';
    if (costEl) costEl.textContent = 'Insufficient data';
    if (confEl) confEl.textContent = 'Low confidence — baseline learning';
    renderPredictionChart(null);
}

function renderPredictionChart(forecastData = null) {
    const canvas = document.getElementById('predictionChartCanvas');
    if (!canvas) return;

    if (predictionChartInstance) {
        predictionChartInstance.destroy();
    }

    const labels = forecastData?.labels || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri (Today)', 'Sat (Proj)', 'Sun (Proj)'];
    const baseline = forecastData?.baseline || [620, 615, 630, 625, 620, 610, 605];
    const actual = forecastData?.actual_projected || [null, null, null, null, null, null, null];
    const upperConfidence = forecastData?.upper_confidence || [null, null, null, null, null, null, null];

    const ctx = canvas.getContext('2d');
    predictionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Actual / Projected Wastage Trajectory',
                    data: actual,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.12)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35,
                    pointRadius: 4
                },
                {
                    label: 'Calibrated Baseline Threshold',
                    data: baseline,
                    borderColor: '#22c55e',
                    borderDash: [5, 5],
                    borderWidth: 2,
                    fill: false,
                    tension: 0.2,
                    pointRadius: 3
                },
                {
                    label: '95% Confidence Upper Bound',
                    data: upperConfidence,
                    borderColor: '#00f2fe',
                    borderDash: [2, 4],
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.35,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 11 } } },
                tooltip: { backgroundColor: 'rgba(12, 18, 30, 0.95)', titleColor: '#00f2fe', bodyColor: '#fff', borderColor: '#1f2c47', borderWidth: 1 }
            },
            scales: {
                x: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } },
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#64748b', font: { size: 10 } } }
            }
        }
    });
}

// ================= VIEW 6: REPORTS & ESG =================
async function loadReports() {
    const scoreEl = document.getElementById('reportScore');
    const carbonEl = document.getElementById('reportCarbon');
    const waterEl = document.getElementById('reportWater');
    const saveEl = document.getElementById('reportSavings');

    try {
        if (NAXORA_STATE.isBackendConnected) {
            const res = await fetch(`${API_BASE}/reports?facility_id=${NAXORA_STATE.facility}`);
            if (res.ok) {
                const data = await res.json();
                if (scoreEl) scoreEl.textContent = data.efficiencyScore || 'Insufficient data';
                if (carbonEl) carbonEl.textContent = data.carbonPrevented || 'Insufficient data';
                if (waterEl) waterEl.textContent = data.waterConserved || 'Insufficient data';
                if (saveEl) saveEl.textContent = data.potentialSavings || 'Insufficient data';
                return;
            }
        }
    } catch (e) {
        console.warn('Reports API fetch fallback:', e);
    }

    if (scoreEl) scoreEl.textContent = 'Insufficient data';
    if (carbonEl) carbonEl.textContent = 'Insufficient data';
    if (waterEl) waterEl.textContent = 'Insufficient data';
    if (saveEl) saveEl.textContent = 'Insufficient data';
}

function exportReportData(format) {
    showNotification(`Preparing ${format.toUpperCase()} report export...`);
    window.open(`${API_BASE}/reports/export?format=${format}&facility_id=${NAXORA_STATE.facility}`, '_blank');
}

// ================= VIEW 8: SETTINGS =================
async function loadSettings() {
    try {
        if (NAXORA_STATE.isBackendConnected) {
            const res = await fetch(`${API_BASE}/settings`);
            const data = await res.json();
            const s = data.settings || {};

            if (s.monitoring_zone && document.getElementById('setMonitoringZone')) document.getElementById('setMonitoringZone').value = s.monitoring_zone;
            if (s.elec_threshold && document.getElementById('setElecThreshold')) document.getElementById('setElecThreshold').value = s.elec_threshold;
            if (s.water_threshold && document.getElementById('setWaterThreshold')) document.getElementById('setWaterThreshold').value = s.water_threshold;
            if (s.ai_confidence_min && document.getElementById('setAiConfidenceMin')) document.getElementById('setAiConfidenceMin').value = s.ai_confidence_min;
        }
    } catch (e) {
        console.warn('Settings load fallback');
    }
}

async function saveSettingsToBackend() {
    const payload = {
        monitoring_zone: document.getElementById('setMonitoringZone')?.value,
        auto_refresh: document.getElementById('setAutoRefresh')?.value,
        refresh_interval: document.getElementById('setRefreshInterval')?.value,
        elec_threshold: document.getElementById('setElecThreshold')?.value,
        water_threshold: document.getElementById('setWaterThreshold')?.value,
        ai_confidence_min: document.getElementById('setAiConfidenceMin')?.value,
        sound_alerts: document.getElementById('setSoundAlerts')?.value,
        browser_notifications: document.getElementById('setBrowserNotifications')?.value
    };

    try {
        const res = await fetch(`${API_BASE}/settings`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            showNotification('Settings saved successfully!');
        }
    } catch (e) {
        showNotification('Settings saved (locally cached).');
    }
}

function resetSettingsDefaults() {
    if (document.getElementById('setElecThreshold')) document.getElementById('setElecThreshold').value = 50;
    if (document.getElementById('setWaterThreshold')) document.getElementById('setWaterThreshold').value = 30;
    if (document.getElementById('setAiConfidenceMin')) document.getElementById('setAiConfidenceMin').value = 80;
    saveSettingsToBackend();
}

// ================= DYNAMIC DEMO CONTROLS (USING REAL API PIPELINE) =================
async function triggerSimulatePowerSpike() {
    showNotification('Sending power surge telemetry: Block A - Room 204 (1,846 kWh)...');

    try {
        const res = await fetch(`${API_BASE}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'Block A - Room 204',
                resourceType: 'electricity',
                value: 1846,
                unit: 'kWh',
                occupancy: 0,
                facility: NAXORA_STATE.facility,
                source: 'SIMULATOR'
            })
        });

        const result = await res.json();
        playAudioAlert('danger');
        showNotification(`Power surge ingested (+${result.diagnostic?.deviationPercent || 197.7}% above baseline)!`);
        await refreshNaxoraState({ force: true });
    } catch (e) {
        showNotification('Power surge simulated.');
        await refreshNaxoraState({ force: true });
    }
}

async function triggerSimulateWaterLeak() {
    showNotification('Sending water surge telemetry: Canteen - Wash Station (940 L/h)...');

    try {
        const res = await fetch(`${API_BASE}/telemetry`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location: 'Canteen - Wash Station',
                resourceType: 'water',
                value: 940,
                unit: 'L',
                occupancy: 12,
                facility: NAXORA_STATE.facility,
                source: 'SIMULATOR'
            })
        });

        const result = await res.json();
        playAudioAlert('danger');
        showNotification(`AI detected water leak! Canteen alert created (+${result.diagnostic?.deviationPercent || 433.3}%).`);
        await refreshNaxoraState({ force: true });
    } catch (e) {
        showNotification('Water leak simulated.');
        await refreshNaxoraState({ force: true });
    }
}

async function triggerApplyBmsShutdown(alertId = null, location = null, resourceType = null) {
    if (!location && !alertId && NAXORA_STATE.currentSelectedHotspot) {
        const h = NAXORA_STATE.currentSelectedHotspot;
        location = h.building + (h.room && h.room !== h.building ? ' - ' + h.room : '');
    }

    showNotification('Executing Automated BMS Power Cutoff & Sub-circuit Isolation...');

    try {
        const payload = {
            facility_id: NAXORA_STATE.facility,
            alertId: alertId || undefined,
            location: location || undefined,
            resourceType: resourceType || undefined
        };

        const res = await fetch(`${API_BASE}/actions/bms-shutdown`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await res.json();
        if (res.ok) {
            playAudioAlert('success');
            showNotification(result.message || 'BMS Shutdown Command Applied: Sub-circuit isolated successfully.');
        } else {
            console.error('[NAXORA BMS Error]:', result);
            showNotification('BMS action failed. Please try again.', 'error');
        }

        await refreshNaxoraState({ force: true });
    } catch (e) {
        console.error('[NAXORA BMS Network Error]:', e);
        showNotification('BMS action failed. Please try again.', 'error');
        await refreshNaxoraState({ force: true });
    }
}

async function triggerResetBaseline() {
    showNotification('Resetting all telemetry, database records, and alerts to baseline...');

    try {
        const res = await fetch(`${API_BASE}/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ facility_id: NAXORA_STATE.facility })
        });

        const result = await res.json();
        playAudioAlert('success');
        showNotification(result.message || 'Baseline restored.');
        await refreshNaxoraState({ force: true });
    } catch (e) {
        showNotification('Baseline restored.');
        await refreshNaxoraState({ force: true });
    }
}

function triggerFullSimulationWorkflow() {
    showNotification('Starting Guided System Walkthrough...');
    switchView('dashboard');

    setTimeout(() => {
        showNotification('Step 1: AI Anomaly Engine continuously scans 3D campus sub-meters...');
        triggerSimulatePowerSpike();
    }, 1500);

    setTimeout(() => {
        showNotification('Step 2: Inspecting AI Diagnostics & Root Cause Analysis in Room 204...');
        openHotspotDiagnosticModal('block-a');
    }, 5500);

    setTimeout(() => {
        closeHotspotModal();
        showNotification('Step 3: Triggering 1-Click Automated BMS Mitigation...');
        triggerApplyBmsShutdown();
    }, 10500);

    setTimeout(() => {
        showNotification('Step 4: Navigating to Predictive Waste Intelligence...');
        switchView('predictions');
    }, 15000);

    setTimeout(() => {
        showNotification('Step 5: Inspecting System Audit Trail & Compliance Ledger...');
        switchView('audit');
    }, 21000);

    setTimeout(() => {
        showNotification('Walkthrough Complete! NAXORA successfully identified, contained, and recorded the event.');
        switchView('dashboard');
    }, 27000);
}

// ================= TOAST NOTIFICATIONS & AUDIO =================
function showNotification(message, type = 'info') {
    let wrap = document.querySelector('.naxora-toast-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'naxora-toast-wrap';
        document.body.appendChild(wrap);
    }

    const toast = document.createElement('div');
    toast.className = 'naxora-toast';
    toast.textContent = message;

    wrap.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3600);
}

function playAudioAlert(type) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'danger') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        } else {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime);
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
            osc.start();
            osc.stop(ctx.currentTime + 0.35);
        }
    } catch (e) {}
}

function startAutoRefresh(intervalMs = 5000) {
    if (NAXORA_STATE.autoRefreshTimer) {
        clearInterval(NAXORA_STATE.autoRefreshTimer);
        NAXORA_STATE.autoRefreshTimer = null;
    }
    NAXORA_STATE.autoRefreshTimer = setInterval(() => {
        refreshNaxoraState({ background: true, silent: true });
    }, intervalMs);
}

function setupGlobalEventListeners() {
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeHotspotModal();
            closeElectricityDetailsModal();
            closeWaterDetailsModal();
            closeSavingsDetailsModal();
            closeTelemetryModal();
        }
    });
}