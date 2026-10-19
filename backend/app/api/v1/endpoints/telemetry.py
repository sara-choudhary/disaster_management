from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.telemetry import TelemetryResponse
from app.schemas.simulation import SimulationRunRecordResponse
from app.services import telemetry_service

router = APIRouter()


@router.get(
    "",
    response_model=TelemetryResponse,
    tags=["Telemetry"],
    summary="Retrieve modeled network telemetry time-series and health metrics",
)
def get_telemetry_metrics(
    time_range: str = Query("24h", description="Time range filter: 15m, 1h, 6h, 24h, all"),
    db: Session = Depends(get_db),
):
    """
    Retrieve deterministic time-series telemetry trends for:
    - Network availability over time
    - Estimated latency
    - Packet delivery ratio & packet loss
    - Link utilization
    - Traffic volume by priority class
    - Recovery duration
    - Route changes over time
    """
    return telemetry_service.get_telemetry_data(db=db, time_range=time_range)


@router.post(
    "/drill",
    response_model=SimulationRunRecordResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Telemetry"],
    summary="Execute an on-demand baseline simulation drill to populate live telemetry",
)
async def run_telemetry_drill(
    drill_name: Optional[str] = Query("ON-DEMAND-TELEMETRY-DRILL", description="Identifier for the simulation drill"),
    db: Session = Depends(get_db),
):
    """
    Execute a live deterministic simulation drill on demand.
    Appends a new verified historical record to SQLite and broadcasts via WebSocket.
    """
    sim_run = telemetry_service.execute_telemetry_drill(db=db, drill_name=drill_name)

    await manager.broadcast_json({
        "event": "SIMULATION_COMPLETED",
        "run_id": sim_run.run_id,
        "scenario_id": sim_run.scenario_id,
        "result": sim_run.result,
        "recovery_duration": sim_run.recovery_duration,
        "timestamp": sim_run.start_time.isoformat(),
        "source": "TELEMETRY_PAGE",
    })

    return SimulationRunRecordResponse.model_validate(sim_run)
