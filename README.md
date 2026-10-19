# Disaster-Resistant Emergency Communication Network with Priority Routing

A fault-tolerant, decentralized full-stack emergency communication management platform designed to operate in disaster zones with degraded, severed, or zero-internet connectivity.

Built with **FastAPI**, **SQLite**, and **React + TypeScript (Vite + Tailwind CSS)**.

---

## Features

- **Decentralized Ad-Hoc Topology:** Graph-based mesh network representation of emergency nodes (Command Centers, Relay Towers, Field Hospitals, Evacuation Shelters).
- **Deterministic Priority Routing:** Dijkstra shortest-path routing algorithm with dynamic edge weighting based on message priority (`CRITICAL_SOS`, `HIGH_MEDICAL`, `NORMAL_LOGISTICS`, `LOW_ROUTINE`), node battery levels, and degraded links.
- **Failover & Detour Simulation:** Simulate physical node damage or disconnection, forcing packets to dynamically reroute through surviving relays.
- **Offline-First & Local:** Zero cloud credentials, external APIs, or paid third-party dependencies required. Runs locally on macOS, Linux, and Windows.

---

## Monorepo Layout

```
disaster_management/
├── .env.example              # Root environment variables sample
├── .gitignore                # Git exclusions (venv, node_modules, sqlite, builds)
├── README.md                 # Complete system documentation
├── docs/                     # Architectural and engineering specifications
│   └── architecture.md
├── backend/                  # Python FastAPI Backend
│   ├── app/
│   │   ├── api/v1/           # Health, nodes, and simulation routers
│   │   ├── core/             # Configuration & SQLAlchemy SQLite engine
│   │   ├── models/           # NetworkNode and EmergencyMessage models
│   │   ├── schemas/          # Pydantic request/response schemas
│   │   └── services/         # Deterministic Dijkstra priority router
│   ├── tests/                # Pytest unit and integration test suite
│   ├── pytest.ini            # Pytest configuration
│   └── requirements.txt      # Python dependencies
└── frontend/                 # React + TypeScript + Vite Frontend
    ├── src/
    │   ├── api/              # Fetch API client and service calls
    │   ├── components/       # Layout, Navbar, and UI widgets
    │   ├── hooks/            # Health monitoring hook
    │   ├── pages/            # Dashboard, Topology (React Flow), Router
    │   ├── types/            # TypeScript interfaces
    │   └── tests/            # Vitest + React Testing Library tests
    ├── package.json          # Node dependencies
    ├── vite.config.ts        # Vite & Vitest configuration
    └── tailwind.config.js    # Tailwind styling config
```

---

## Quickstart Guide

### Prerequisites
- **Python**: 3.9+ installed
- **Node.js**: 18+ and `npm` installed

---

### Backend Setup (FastAPI & SQLite)

1. Open your terminal in the root directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **macOS / Linux:**
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
   - **Windows:**
     ```powershell
     python -m venv venv
     venv\Scripts\activate
     ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Start the backend development server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. The backend will be available at:
   - API Root: `http://127.0.0.1:8000/`
   - Health Check: `http://127.0.0.1:8000/api/health`
   - Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

---

### Frontend Setup (React, Vite, Tailwind)

1. Open a new terminal in the project root:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```

4. The frontend will be available at:
   - Web UI: `http://localhost:5173`

---

## Running Automated Tests

### Backend Tests (pytest)
From the project root:
```bash
PYTHONPATH=backend backend/venv/bin/pytest backend
```
*(Or from within `backend/` with venv activated: `pytest`)*

### Frontend Tests (Vitest)
From the project root:
```bash
cd frontend && npm test
```

### Frontend Production Build
```bash
cd frontend && npm run build
```

---

## Core API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check (server + SQLite status) |
| `GET` | `/api/v1/nodes` | List all mesh topology nodes (auto-seeded) |
| `POST` | `/api/v1/nodes` | Register a new mesh node |
| `GET` | `/api/v1/nodes/{node_id}` | Fetch specific node telemetry |
| `PATCH` | `/api/v1/nodes/{node_id}` | Update node status (active/degraded/offline) |
| `POST` | `/api/v1/simulation/route` | Run deterministic priority routing simulation |
| `GET` | `/api/v1/simulation/messages`| Retrieve logged transmission messages |
