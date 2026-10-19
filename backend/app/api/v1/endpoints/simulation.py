from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.message import EmergencyMessage
from app.schemas.message import MessageResponse
from app.schemas.simulation import SimulationRunRequest, SimulationRunResponse
from app.services.simulation import run_deterministic_simulation

router = APIRouter()


@router.post("/route", response_model=SimulationRunResponse, tags=["Simulation"])
def simulate_message_routing(
    payload: SimulationRunRequest,
    db: Session = Depends(get_db),
):
    """Run deterministic priority routing simulation between two nodes."""
    result = run_deterministic_simulation(db=db, request=payload)
    return result


@router.get("/messages", response_model=List[MessageResponse], tags=["Simulation"])
def list_dispatched_messages(
    limit: int = 50,
    db: Session = Depends(get_db),
):
    """Retrieve logged emergency messages and routing outcomes."""
    messages = (
        db.query(EmergencyMessage)
        .order_by(desc(EmergencyMessage.created_at))
        .limit(limit)
        .all()
    )
    return messages
