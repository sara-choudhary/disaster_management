from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    network,
    nodes,
    links,
    departments,
    traffic_classes,
    traffic,
    scenarios,
    simulations,
    simulation,
    events,
    alerts,
    access_rules,
    reports,
    security_demos,
    telemetry,
)

api_router = APIRouter()

# Health checks
api_router.include_router(health.router)

# Core Network Mesh APIs
api_router.include_router(network.router, prefix="/network")

# Resource CRUD & Direct Collections
api_router.include_router(nodes.router, prefix="/nodes")
api_router.include_router(links.router, prefix="/links")
api_router.include_router(departments.router, prefix="/departments")
api_router.include_router(traffic_classes.router, prefix="/traffic-classes")
api_router.include_router(traffic.router, prefix="/traffic")

# Drill Scenarios & Simulation Runs
api_router.include_router(scenarios.router, prefix="/scenarios")
api_router.include_router(simulations.router, prefix="/simulations")
api_router.include_router(simulation.router, prefix="/simulation")

# Observability, Audit & Security
api_router.include_router(events.router, prefix="/events")
api_router.include_router(alerts.router, prefix="/alerts")
api_router.include_router(access_rules.router, prefix="/access-rules")
api_router.include_router(security_demos.router, prefix="/security-demos")

# Reports & Engineering Post-Mortems
api_router.include_router(reports.router, prefix="/reports")

# Telemetry Time-Series & Snapshot Metrics
api_router.include_router(telemetry.router, prefix="/telemetry")
