# Disaster-Resistant Emergency Communication Network with Priority Routing

An educational, fault-tolerant network simulation and emergency operations management platform designed to model municipal communication continuity, dynamic shortest-path rerouting, priority traffic scheduling (QoS), departmental VLAN segmentation, and automated fault recovery under catastrophic infrastructure failure.

---

## Educational Simulation Disclaimer
> [!IMPORTANT]
> **Educational Simulation Notice**: This web application is an educational simulation platform and software modeling environment. It is **not** a physical Cisco IOS, Junos, or Arista router controller, nor does it configure real networking hardware or execute kernel-level packet injection.
> - **Routing Calculations**: Based on an OSPF-inspired Dijkstra Shortest Path First (SPF) software engine that recalculates routes over an in-memory graph.
> - **QoS & Link Metrics**: Packet delivery ratios, link saturation, queuing delay, and BFD convergence timers are **modeled, computed estimates** rather than physical telecommunication measurements.

---

## Team Members
- **Aahaan Kothari** — 24BDS0273
- **Sara Choudhary** — 24BCT0219
- **Aryan Verma** — 24BCT0223

---

## 1. Abstract
During catastrophic natural disasters (earthquakes, flash floods, hurricanes) or civil crises, conventional commercial communication backbones frequently suffer physical line cuts, power outages, and extreme bandwidth congestion. Municipal emergency responders—emergency operations centers, police departments, fire suppression teams, trauma hospitals, and ambulance services—require dependable, prioritized packet transmission to coordinate rescue operations.

This project delivers a full-stack, local-first emergency communication management system. It models an ad-hoc municipal network topology consisting of 4 core backbone routers, 7 departmental access switches, emergency response stations, and microwave relays. When physical links or routers fail, the platform deterministically computes alternate loop-free detours, enforces strict priority queuing for life-safety telemetry with starvation safeguards for lower tiers, applies departmental VLAN access control policies, streams real-time updates over WebSockets, and persists all drill runs and forensic audit logs into SQLite.

---

## 2. Problem Statement
Commercial cellular networks and internet service providers are fundamentally centralized and fragile in emergency scenarios:
1. **Single Points of Failure:** Physical fiber conduit severances isolate entire response centers when routing protocols fail to converge rapidly.
2. **Bandwidth Saturation:** Routine citizen calls and bulk data saturate degraded links, starving life-saving medical telemetry and emergency triage dispatches.
3. **Inter-Departmental Security Risks:** Connecting disparate civic departments and humanitarian camps without segmentation risks unauthorized access to tactical command centers.
4. **Lack of Forensic Traceability:** First responders lack auditable diagnostic records of network failures, convergence delays, and packet loss history after an incident.

---

## 3. Project Objectives
- **Deterministic SPF Routing:** Implement an OSPF-inspired graph routing engine capable of calculating optimal paths, detecting topological failures, and recalculating loop-free detours.
- **Modeled Recovery Duration:** Model non-hardcoded recovery timing incorporating BFD detection ($3 \times 15\text{ms}$ keepalives), Dijkstra graph traversal, hardware FIB rewrites, and path propagation delay.
- **Priority-Based Quality of Service (QoS):** Provide 4 deterministic traffic classes (`CRITICAL`, `HIGH`, `NORMAL`, `LOW`) with strict priority scheduling for life-safety communications and starvation protection for baseline traffic.
- **VLAN & Access Control Enforcement (ACL):** Enforce departmental segmentation across 7 VLANs (VLAN 10 through 70) while cleanly decoupling physical routing reachability from access authorization.
- **Full-Duplex Event Synchronization:** Broadcast real-time network topology events, alert lifecycle updates, and simulation results over WebSockets with automatic reconnection and HTTP polling fallback.
- **Auditable History & Exports:** Persist all simulation runs in an SQLite database, supporting paginated drill inspections, CSV history exports, and full JSON diagnostic dumps.
- **Restrained Operational UI:** Deliver an accessible, calm emergency console using a refined coastal pastel palette without decorative glowing elements, fake progress timers, or marketing hype.

---

## 4. Architecture Overview

### Monorepo Structure
```
disaster_management/
├── backend/                  # FastAPI 0.110+ Asynchronous Python Application
│   ├── app/
│   │   ├── api/v1/           # API Routers (network, traffic, access_rules, reports, alerts)
│   │   ├── core/             # Database session manager, config, WebSocket connection manager
│   │   ├── models/           # SQLAlchemy ORM Models (SQLite)
│   │   ├── schemas/          # Pydantic v2 Request/Response validation models
│   │   └── services/         # Algorithmic Services (Dijkstra, QoS, ACL, BFD, Seed Data)
│   ├── tests/                # 90 Pytest Unit, Integration, and E2E Tests
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React 18 + TypeScript + Vite + Tailwind CSS
│   ├── src/
│   │   ├── api/              # Typed REST client functions
│   │   ├── components/       # Layout, Header, Sidebar, Canvas, Modals, Inspectors
│   │   ├── context/          # NetworkEventContext (WebSocket + Polling Sync)
│   │   ├── pages/            # 7 Primary Route Views + Landing Page
│   │   ├── types/            # TypeScript Interface Definitions
│   │   └── tests/            # 54 Vitest + React Testing Library Tests (10 suites)
│   ├── dist/                 # Optimized production build artifacts
│   └── package.json
└── docs/
    ├── ARCHITECTURE.md       # Comprehensive System Architecture Specification
    └── DEMO_GUIDE.md          # 12-Step End-to-End Operational Walkthrough
```

For comprehensive structural diagrams, mathematical formulations, and component interaction models, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 5. Technology Stack

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) 0.110+ (Asynchronous Python REST API)
- **ASGI Server:** [Uvicorn](https://www.uvicorn.org/) with WebSockets support
- **ORM & Database:** [SQLAlchemy](https://www.sqlalchemy.org/) 2.0+ with [SQLite](https://www.sqlite.org/) (zero external database servers or cloud dependencies required)
- **Validation:** [Pydantic](https://docs.pydantic.dev/) v2 (strict request/response typing)
- **Testing:** [Pytest](https://pytest.org/) 8.0+ with `pytest-asyncio` and `httpx` (90 tests passing)

### Frontend
- **Library:** [React](https://react.dev/) 18 with [TypeScript](https://www.typescriptlang.org/) 5.4+
- **Bundler:** [Vite](https://vitejs.dev/) 5.4+ (production minification & chunking)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) 3.4+ configured with custom coastal palette design tokens
- **Data Visualization:** [Recharts](https://recharts.org/) 2.12+ (accessible, colorblind-friendly SVG charts)
- **Icons:** [Lucide React](https://lucide.dev/) (standardized emergency console icons)
- **Testing:** [Vitest](https://vitest.dev/) + React Testing Library (54 tests passing across 10 test files)

---

## 6. Primary API Endpoints

All endpoints are prefixed with `/api/v1` (with automatic interactive OpenAPI documentation available at `http://localhost:8000/docs`).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check (database connection status, version, uptime) |
| `GET` | `/api/v1/network/topology` | Full graph topology (nodes, links, departments, subnets) |
| `GET` | `/api/v1/network/metrics` | Real-time network availability, health score, active links, down count |
| `GET` | `/api/v1/network/reachability` | Reachability matrix of all municipal stations |
| `GET` | `/api/v1/network/routes` | Deterministic OSPF shortest-path calculation between source & destination |
| `POST` | `/api/v1/network/links/{id}/failure` | Inject physical link failure, trigger BFD detection & rerouting |
| `POST` | `/api/v1/network/links/{id}/restore` | Restore severed link to operational UP state |
| `POST` | `/api/v1/network/nodes/{id}/failure` | Simulate router or switch hardware outage |
| `POST` | `/api/v1/network/restore` | Controlled baseline reset (restores all links & nodes; preserves history) |
| `POST` | `/api/v1/traffic/simulate` | Deterministic QoS priority scheduling simulation with competing traffic |
| `POST` | `/api/v1/access-rules/evaluate` | 5-tuple departmental ACL evaluation (routing vs. authorization) |
| `GET` | `/api/v1/alerts` | Filterable active and resolved emergency incidents and alerts |
| `PATCH`| `/api/v1/alerts/{id}` | Acknowledge or resolve an active alert |
| `GET` | `/api/v1/events` | Chronological forensic event timeline |
| `GET` | `/api/v1/reports/summary` | Aggregated executive performance report across all drills |
| `GET` | `/api/v1/reports/history` | Paginated simulation run history with search and status filters |
| `GET` | `/api/v1/reports/export/csv` | Download complete historical drill record as CSV |
| `GET` | `/api/v1/reports/export/json/{id}` | Export complete diagnostic audit log for a specific run in JSON format |
| `WS` | `/ws/network-events` | Full-duplex WebSocket feed for live topology, alert, and route events |

---

## 7. Database Schema

The SQLite database (`backend/data/disaster_resilience.db`) maintains complete persistence across restarts:

- **`network_nodes`**: `id`, `node_id`, `name`, `node_type`, `department`, `ip_address`, `status` (`active`, `degraded`, `offline`), `battery_level`, `pos_x`, `pos_y`, `extra_metadata`.
- **`network_links`**: `id`, `link_id`, `source_node_id`, `destination_node_id`, `link_type`, `bandwidth`, `latency`, `link_cost`, `operational_state` (`UP`, `DEGRADED`, `DOWN`).
- **`departments`**: `id`, `code`, `name`, `department_type`, `subnet`, `gateway`, `vlan_id`, `priority`.
- **`traffic_classes`**: `id`, `code`, `name`, `priority`, `bandwidth_req`, `latency_budget`.
- **`access_rules`**: `id`, `rule_id`, `source`, `destination`, `protocol`, `action` (`PERMIT`, `DENY`), `enabled`.
- **`simulation_runs`**: `id`, `run_id`, `scenario_id`, `scenario_name`, `start_time`, `completion_time`, `final_outcome`, `recovery_duration_sec`, `packet_statistics`, `initial_topology`, `final_topology`, `route_changes`.
- **`network_events`**: `id`, `event_id`, `timestamp`, `event_type`, `severity`, `resource_id`, `message`, `simulation_run_id`.
- **`alerts`**: `id`, `alert_id`, `timestamp`, `severity`, `category`, `affected_resource`, `description`, `status` (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`).

---

## 8. Known Limitations
1. **Software-Modeled Simulation:** The application models networking behavior in software. It does not run live routing daemons (`frr`, `quagga`) or modify operating system routing tables.
2. **Simplified Congestion Mathematics:** Queuing delays and packet drops are calculated deterministically using M/M/1-inspired queueing formulations rather than running a microsecond-level discrete-event network simulator (like ns-3).
3. **Single In-Process SQLite Engine:** SQLite is utilized for zero-configuration, local-first disaster environments. In large-scale multi-operator command centers with hundreds of concurrent administrators, an external distributed database (such as PostgreSQL) would be required.
4. **Broadcast Domain Simplification:** Ethernet broadcast storms and ARP table convergence are simulated logically at Layer 3 rather than modeled down to Layer 2 frame collision domains.

---

## 9. Quickstart & Installation Instructions

### Prerequisites
- **Python**: 3.9+ installed
- **Node.js**: 18+ and `npm` installed
- **Git**: Installed

---

### macOS / Linux Setup

1. **Clone and enter the repository:**
   ```bash
   cd /path/to/disaster_management
   ```

2. **Configure and start the Backend:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **In a second terminal, configure and start the Frontend:**
   ```bash
   cd /path/to/disaster_management/frontend
   npm install
   npm run dev
   ```

4. **Access the application:**
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API Root**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
   - **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

---

### Windows PowerShell Setup

1. **Open PowerShell as Administrator (or standard user) in the project root:**
   ```powershell
   cd disaster_management
   ```

2. **Configure and start the Backend:**
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

3. **In a second PowerShell window, configure and start the Frontend:**
   ```powershell
   cd disaster_management\frontend
   npm install
   npm run dev
   ```

4. **Access the application:**
   - **Frontend UI**: `http://localhost:5173`
   - **Backend API**: `http://127.0.0.1:8000`
   - **Swagger Docs**: `http://127.0.0.1:8000/docs`

---

## 10. Test Verification Commands

To verify full-stack system health:

### Run Backend Tests (Pytest)
```bash
# From the backend directory with venv activated:
pytest -v
```
*Result: 90 passed in ~2.6s (Includes E2E 12-step operational test)*

### Run Frontend Tests (Vitest)
```bash
# From the frontend directory:
npm test -- --run
```
*Result: 54 passed across 10 test suites in ~1.8s*

### Run TypeScript Type Check
```bash
# From the frontend directory:
npx tsc --noEmit
```
*Result: 0 errors*

### Run Production Build
```bash
# From the frontend directory:
npm run build
```
*Result: Production build generated cleanly in `frontend/dist`*

---

## 11. Operational Demo Guide
For the complete 12-step interactive demonstration walkthrough, refer to [docs/DEMO_GUIDE.md](docs/DEMO_GUIDE.md).
