from datetime import datetime
from typing import List
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.simulation import (
    SimulationCreateRequest,
    SimulationRunRecordResponse,
)
from app.services import simulation_service

router = APIRouter()


@router.post(
    "",
    response_model=SimulationRunRecordResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Simulations"],
)
async def start_simulation_run(
    payload: SimulationCreateRequest,
    db: Session = Depends(get_db),
):
    """Execute a deterministic emergency priority network simulation drill and persist results."""
    # 1. Broadcast SIMULATION_STARTED
    start_evt_id = f"EVT-START-{uuid.uuid4().hex[:8].upper()}"
    await manager.broadcast_json({
        "event_id": start_evt_id,
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": "SIMULATION_STARTED",
        "event": "SIMULATION_STARTED",
        "severity": "INFO",
        "resource_id": payload.target_node_id or payload.scenario_id or "NETWORK",
        "affected_resource": payload.target_node_id or payload.scenario_id or "NETWORK",
        "scenario_id": payload.scenario_id,
        "source": payload.source_node_id,
        "destination": payload.target_node_id,
        "priority": payload.priority,
    })

    sim_run, broadcast_payload = simulation_service.create_simulation_run(
        db=db,
        request=payload,
    )
    # 2. Broadcast SIMULATION_COMPLETED or SIMULATION_FAILED via WebSocket
    await manager.broadcast_json(broadcast_payload)
    return SimulationRunRecordResponse.model_validate(sim_run)


@router.get(
    "",
    response_model=List[SimulationRunRecordResponse],
    tags=["Simulations"],
)
def list_simulation_runs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve historical simulation runs with pagination."""
    runs = simulation_service.list_simulations(db=db, skip=skip, limit=limit)
    return [SimulationRunRecordResponse.model_validate(r) for r in runs]


@router.get(
    "/{run_id}",
    response_model=SimulationRunRecordResponse,
    tags=["Simulations"],
)
def get_simulation_run(
    run_id: str,
    db: Session = Depends(get_db),
):
    """Retrieve details for a specific simulation drill run."""
    run = simulation_service.get_simulation_run(db=db, run_id=run_id)
    return SimulationRunRecordResponse.model_validate(run)


@router.post(
    "/{run_id}/stop",
    response_model=SimulationRunRecordResponse,
    tags=["Simulations"],
)
async def stop_simulation_run(
    run_id: str,
    db: Session = Depends(get_db),
):
    """Stop an ongoing simulation drill run."""
    run, broadcast_payload = simulation_service.stop_simulation_run(db=db, run_id=run_id)
    await manager.broadcast_json(broadcast_payload)
    return SimulationRunRecordResponse.model_validate(run)
