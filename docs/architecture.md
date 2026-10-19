# Disaster-Resistant Emergency Communication Network with Priority Routing

## Architecture Overview

This project provides an emergency-resilient communication network simulation and management platform designed to operate in degraded or disaster environments without external internet dependencies.

### Monorepo Structure

```
disaster_management/
├── .env.example              # Sample environment configuration
├── .gitignore                # Git ignore patterns for Python, Node, Vite, SQLite
├── README.md                 # Project documentation and quickstart instructions
├── docs/                     # Architectural and design documentation
│   └── architecture.md       # High-level architecture and system design
├── backend/                  # FastAPI + SQLAlchemy + SQLite application
│   ├── app/
│   │   ├── api/              # API router and endpoints (health, nodes, simulation)
│   │   ├── core/             # Configuration and database engine setup
│   │   ├── models/           # SQLAlchemy ORM models
│   │   ├── schemas/          # Pydantic validation schemas
│   │   └── services/         # Deterministic routing & simulation logic
│   ├── tests/                # pytest test suite
│   ├── requirements.txt      # Python dependencies
│   └── .env.example          # Backend environment variables
└── frontend/                 # React + TypeScript + Vite + Tailwind CSS
    ├── src/
    │   ├── api/              # Axios / Fetch HTTP client layer
    │   ├── components/       # Reusable UI components & layouts
    │   ├── hooks/            # Custom React hooks
    │   ├── pages/            # Page-level route views
    │   ├── types/            # TypeScript data interfaces
    │   └── tests/            # Vitest + React Testing Library unit tests
    ├── package.json          # Node dependencies and scripts
    └── vite.config.ts        # Vite configuration with Vitest setup
```

### Core Design Principles
1. **Local & Zero-Cost:** Operates purely locally on SQLite and standard HTTP protocols, requiring no cloud subscriptions or third-party APIs.
2. **Resilience & Priority Routing:** Designed around node graphs where message packets are prioritized (Emergency > Medical/Logistics > Routine) and routed around damaged or severed nodes.
3. **Deterministic Simulation:** Network hops, packet delivery, and link degradation follow reproducible, deterministic state machine logic for dependable testing and disaster drills.
