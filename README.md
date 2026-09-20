# NAXORA — AI Campus Resource Guardian

> **AI-Powered Campus Resource Waste Hotspot Mapper, Anomaly Detection & Automated BMS Mitigation Platform**  
> *Production & Hackathon Ready Prototype*

---

## 1. Overview & Problem Statement

Educational institutions and commercial facilities waste thousands of kilowatt-hours of electricity and tens of thousands of liters of water each day due to:
- Non-occupancy equipment usage (HVAC units, GPU workstations, and lighting left running in empty rooms).
- Unmonitored standby vampire loads across server racks and labs.
- Sub-surface plumbing line ruptures, continuous valve leaks, and pressure drops.

Traditional utility bills provide only monthly aggregate values without real-time spatial context, automated root-cause diagnosis, or direct mitigation mechanisms.

**NAXORA** solves this by providing:
1. **Live Spatial Waste Hotspot Mapping**: Building & room-level telemetry visualizer mapping anomalies directly onto a campus map.
2. **Explainable AI Anomaly Detection Engine**: Sub-meter pattern analysis comparing live sensor readings against calibrated baselines with dynamic confidence scores and 5-point root-cause explainability.
3. **Statistical Waste Forecasting & Dynamic Savings**: 7-day rolling horizon waste projections and dynamic rupee savings calculations.
4. **Automated BMS Mitigation Controller**: Remote simulated Building Management System (BMS) load-shedding and valve isolation.
5. **Post-Action Impact Verification & Immutable Audit Ledger**: Verified reduction measurement and tamper-evident audit logs with localized timestamps.
6. **Real-Time Synchronization**: 5-second automatic polling and instant telemetry event broadcast across all 8 dedicated views.

---

## 2. System Architecture

```
                       +-----------------------------------+
                       |         NAXORA FRONTEND           |
                       |      (HTML5 / CSS3 / ES6)         |
                       |  window.NAXORA_CONFIG / API_BASE  |
                       +-----------------+-----------------+
                                         |
                                         | REST APIs & Polling (5s)
                                         v
                       +-----------------------------------+
                       |         EXPRESS BACKEND           |
                       |       (Node.js REST Server)       |
                       +-----------------+-----------------+
                                         |
             +---------------------------+---------------------------+
             |                           |                           |
             v                           v                           v
+-------------------------+ +-------------------------+ +-------------------------+
|    AI ANOMALY ENGINE    | |    PREDICTION ENGINE    | |   SQLITE DATABASE SYNC  |
|  (Dynamic Baselines &   | | (7-Day Rolling Horizon  | |   (Single Source of     |
|   5-Point Diagnostics)  | |  & Dynamic Cost Avoid)  | |    Truth: naxora.db)    |
+-------------------------+ +-------------------------+ +-------------------------+
             |                           |                           |
             +---------------------------+---------------------------+
                                         |
                                         v
                       +-----------------------------------+
                       |       BMS ACTION CONTROLLER       |
                       |  (Safe Mitigation & Verification) |
                       +-----------------------------------+
```

---

## 3. Environment Configuration & Deployment

### Environment Variables (`.env`)
Create a `.env` file in the root directory (refer to `.env.example`):

```env
PORT=5000
NODE_ENV=production
DB_PATH=./server/db/naxora.db
CORS_ORIGIN=*
```

### Deployment Modes
1. **Unified Monolithic Hosting (Default)**:
   The Express backend serves both the REST API and the static frontend on the same port (`http://localhost:5000`).
2. **Decoupled Frontend / Backend Hosting**:
   When hosting the frontend separately (e.g. Vercel, Netlify, S3), configure the API endpoint before loading `script.js`:
   ```html
   <script>
     window.NAXORA_CONFIG = {
       API_BASE_URL: 'https://your-naxora-api.example.com/api'
     };
   </script>
   ```

---

## 4. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend health check and uptime status |
| `GET` | `/api/dashboard` | Aggregated dashboard KPIs, priority alerts, top insight, and zones |
| `POST` | `/api/telemetry` | Telemetry ingestion endpoint for sensor readings |
| `GET` | `/api/hotspots` | Spatial campus hotspot listings with severity classifications |
| `GET` | `/api/alerts` | Unified active and resolved alerts repository (supports `?status=ACTIVE`) |
| `POST` | `/api/alerts` | Creates a new monitored alert |
| `POST` | `/api/alerts/:id/resolve` | Resolves an alert and returns monitored zone to normal |
| `GET` | `/api/insights` | Explainable AI root-cause diagnostics & anomaly recommendations |
| `GET` | `/api/predictions` | 7-day statistical rolling waste forecast trajectories |
| `GET` | `/api/savings` | Dynamic potential savings breakdown by location and resource |
| `POST` | `/api/actions/bms-shutdown` | Executes automated BMS sub-circuit or valve isolation |
| `GET` | `/api/audit` | Immutable audit ledger and event logs with localized timestamps |
| `GET` | `/api/reports` | ESG impact metrics, carbon avoidance, and efficiency scoring |
| `GET` | `/api/resources` | Monitored resource streams (Electricity, Water, Gas, HVAC) |
| `GET` | `/api/settings` | Campus monitoring configurations and refresh intervals |
| `POST` | `/api/reset` | Restores calibrated baseline state and active alerts |

---

## 5. Quick Start & Startup Commands

### Prerequisites
- Node.js (v18+ or v24+ recommended)
- Web browser (Chrome, Edge, Firefox, Safari)

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Start the NAXORA backend & frontend server
npm start

# Or run in development mode
npm run dev
```
*Access the live application at `http://localhost:5000`.*

---

## 6. End-to-End Judge Demonstration Script (Flow A through K)

1. **Step A: Baseline State**:
   - Open `http://localhost:5000`.
   - Observe baseline KPIs: Electricity (`1,486 kWh`), Water (`240 L`), Active Alerts (`3`), Recoverable Savings (`Rs. 72,619`).
2. **Step B: Spatial Hotspot Map**:
   - Verify room-specific markers on the 3D campus map: `Block A - Room 204` (CRITICAL), `Main Canteen - Wash Station` (HIGH), `Lab 2 - Server Rack` (MEDIUM), and `Block B - Room 105` (NORMAL).
3. **Step C: Explainable AI Diagnostics**:
   - Navigate to **AI Insights** or click **Block A - Room 204**.
   - Read the 5-point root-cause analysis explaining after-hours HVAC & GPU load during zero occupancy.
4. **Step D: 7-Day Waste Forecasting**:
   - Switch to **Predictions** view to see the 7-day rolling waste trajectory and projected avoidable costs.
5. **Step E: Telemetry Submission**:
   - Use the Telemetry input to submit a reading or trigger simulation.
   - Observe instant UI updates without manual browser refresh.
6. **Step F: Execute BMS Shutdown**:
   - Click **`APPLY AUTOMATED BMS SHUTDOWN`** on Block A.
   - The load returns to baseline (`620 kWh`), avoidable waste of `866 kWh` (Rs. 2,07,840) is mitigated, and the alert status changes to `RESOLVED`.
7. **Step G: Post-Action Verification**:
   - Submit post-action telemetry (`620 kWh`).
   - The impact engine verifies 100% waste reduction and marks the mitigation as `VERIFIED`.
8. **Step H: Zone Isolation**:
   - Ingest nominal telemetry for `Block B - Room 105` (`400 kWh`).
   - Block B remains `NORMAL` without false triggers.
9. **Step I: Lab 2 Medium Anomaly Consistency**:
   - Lab 2 is consistently displayed across Map, Alerts, and Insights, and supports direct BMS action.
10. **Step J: Audit Ledger**:
    - Switch to **System Audit** to inspect the immutable event log with localized timestamps.
11. **Step K: Clean Demo Replay**:
    - Click **`RESET BASELINE`** in the header to return the entire system to a fresh demonstration state.

---

## 7. Project Directory Structure

```
/NAXORA
  ├── index.html                  # Responsive SaaS dashboard & multi-view UI
  ├── script.js                   # Central state engine, API connector & refresh loop
  ├── style.css                   # Theme styling, radar animations, responsive layout
  ├── campus-map.png              # Spatial isometric campus visualizer
  ├── package.json                # Project dependencies and npm scripts
  ├── .env.example                # Deployment environment variable template
  ├── .env                        # Local development environment file
  ├── server/
  │   ├── server.js               # Express application entrypoint & static host
  │   ├── database.js             # SQLite DatabaseSync manager & baseline seeder
  │   ├── db/
  │   │   ├── naxora.db           # SQLite database file
  │   │   └── schema.sql          # Database table definitions
  │   ├── routes/
  │   │   ├── dashboard.js        # Dashboard KPIs & aggregated state
  │   │   ├── telemetry.js        # Ingestion & real-time streams
  │   │   ├── alerts.js           # Alerts repository & lifecycle
  │   │   ├── insights.js         # AI anomaly diagnostics
  │   │   ├── predictions.js      # 7-day rolling waste forecasts
  │   │   ├── savings.js          # Dynamic financial savings calculations
  │   │   ├── simulations.js      # BMS actions & simulation injectors
  │   │   ├── audit.js            # Immutable audit event log
  │   │   ├── reports.js          # ESG impact & sustainability scores
  │   │   ├── hotspots.js         # Campus zone listings
  │   │   ├── resources.js        # Monitored resource definitions
  │   │   ├── facilities.js       # Campus & facility listings
  │   │   ├── settings.js         # System configuration settings
  │   │   └── system.js           # System health endpoint
  │   └── services/
  │       ├── anomalyEngine.js    # Explainable AI anomaly evaluation
  │       ├── predictionEngine.js # Rolling statistical forecasting
  │       ├── telemetryEngine.js  # Telemetry ingestion pipeline
  │       └── simulatorEngine.js  # Realistic event generator
  └── test_step7_hackathon_demo.js# End-to-end hackathon test suite
```

---

## 8. Verification & Test Suites

NAXORA includes a comprehensive automated test suite covering all functionality:
```bash
# Run the complete Step 7 Hackathon & Deployment test suite
node test_step7_hackathon_demo.js

# Run all regression test suites
node test_final_sync_fixes.js
node test_step6_realtime_synchronization.js
node test_step5_actions_bms_audit.js
node test_step4_predictions_savings.js
node test_step3_verification.js
node test_step2_verification.js
```

---

## 9. License

Developed for Hackathon Product Demonstration. Prototype Demonstration.