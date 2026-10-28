from typing import Optional
from fastapi import APIRouter, Depends, Query, status, Response
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


@router.get("/export/csv", tags=["Telemetry"])
def export_telemetry_csv(
    time_range: str = Query("24h", description="Time range: 15m, 1h, 6h, 24h, all"),
    db: Session = Depends(get_db),
):
    """Export telemetry historical trends as a CSV document."""
    from app.services import simulation_service
    csv_content = simulation_service.export_telemetry_csv(db=db, time_range=time_range)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=telemetry_history.csv"},
    )


@router.get("/export/json", tags=["Telemetry"])
def export_telemetry_json(
    time_range: str = Query("24h", description="Time range: 15m, 1h, 6h, 24h, all"),
    db: Session = Depends(get_db),
):
    """Export telemetry historical trends in JSON format."""
    from app.services import simulation_service
    json_content = simulation_service.export_telemetry_json(db=db, time_range=time_range)
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=telemetry_history.json"},
    )
