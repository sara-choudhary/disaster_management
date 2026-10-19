from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.traffic_class import TrafficClass
from app.schemas.traffic_class import TrafficClassCreate, TrafficClassResponse
from app.services.seed_data import seed_database_idempotent

router = APIRouter()


@router.get("", response_model=List[TrafficClassResponse], tags=["Traffic Classes"])
def list_traffic_classes(db: Session = Depends(get_db)):
    """Retrieve all QoS traffic priority classes."""
    seed_database_idempotent(db)
    return db.query(TrafficClass).order_by(TrafficClass.priority.asc()).all()


@router.post("", response_model=TrafficClassResponse, status_code=status.HTTP_201_CREATED, tags=["Traffic Classes"])
def create_traffic_class(payload: TrafficClassCreate, db: Session = Depends(get_db)):
    """Register a new traffic priority class."""
    existing = db.query(TrafficClass).filter(TrafficClass.code == payload.code).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Traffic class '{payload.code}' already exists",
        )
    tc = TrafficClass(**payload.model_dump())
    db.add(tc)
    db.commit()
    db.refresh(tc)
    return tc
