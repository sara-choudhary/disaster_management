from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.models.event import NetworkEvent
from app.schemas.event import NetworkEventResponse, ForensicTimelineResponse
from app.services import event_service
from app.services.seed_data import seed_database_idempotent

router = APIRouter()


@router.get("", response_model=List[NetworkEventResponse], tags=["Events"])
def list_network_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    severity: Optional[str] = Query(None, description="Filter by event severity (INFO, WARNING, CRITICAL)"),
    resource: Optional[str] = Query(None, description="Filter by affected resource ID"),
    run_id: Optional[str] = Query(None, description="Filter by related simulation run ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    time_range: Optional[str] = Query(None, description="Filter by time range: 15m, 1h, 6h, 24h, all"),
    db: Session = Depends(get_db),
):
    """Retrieve logged network events, packet routing outcomes, and state transitions with pagination and filters."""
    seed_database_idempotent(db)
    query = db.query(NetworkEvent).order_by(desc(NetworkEvent.timestamp))

    if severity:
        query = query.filter(NetworkEvent.severity == severity.upper())
    if resource:
        query = query.filter(
            (NetworkEvent.affected_resource == resource)
            | (NetworkEvent.affected_resource.contains(resource))
        )
    if run_id:
        query = query.filter(NetworkEvent.related_run == run_id)
    if event_type:
        query = query.filter(NetworkEvent.event_type == event_type.upper())
    if time_range:
        now = datetime.utcnow()
        range_map = {
            "15m": timedelta(minutes=15),
            "1h": timedelta(hours=1),
            "6h": timedelta(hours=6),
            "24h": timedelta(hours=24),
        }
        if time_range.lower() in range_map:
            cutoff = now - range_map[time_range.lower()]
            query = query.filter(NetworkEvent.timestamp >= cutoff)

    return query.offset(skip).limit(limit).all()


@router.get("/timeline/{run_id}", response_model=ForensicTimelineResponse, tags=["Events"])
def get_run_forensic_timeline(run_id: str, db: Session = Depends(get_db)):
    """
    Retrieve a forensic chronological incident timeline for a specific historical simulation run.
    Provides complete audit sequence (failures, SPF recalculation, packet audit, access control, recovery)
    in read-only mode without mutating live network state.
    """
    seed_database_idempotent(db)
    return event_service.get_forensic_timeline(db=db, run_id=run_id)
