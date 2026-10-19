from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.scenario import Scenario
from app.schemas.scenario import ScenarioCreate, ScenarioResponse
from app.services.seed_data import seed_database_idempotent

router = APIRouter()


@router.get("", response_model=List[ScenarioResponse], tags=["Scenarios"])
def list_scenarios(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Retrieve pre-configured disaster drills and failure scenarios."""
    seed_database_idempotent(db)
    return db.query(Scenario).offset(skip).limit(limit).all()


@router.post("", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED, tags=["Scenarios"])
def create_scenario(payload: ScenarioCreate, db: Session = Depends(get_db)):
    """Register a new disaster drill scenario."""
    existing = db.query(Scenario).filter(Scenario.scenario_id == payload.scenario_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Scenario '{payload.scenario_id}' already exists",
        )
    scen = Scenario(**payload.model_dump())
    db.add(scen)
    db.commit()
    db.refresh(scen)
    return scen


@router.get("/{scenario_id}", response_model=ScenarioResponse, tags=["Scenarios"])
def get_scenario(scenario_id: str, db: Session = Depends(get_db)):
    """Retrieve details for a specific drill scenario by scenario_id or ID."""
    seed_database_idempotent(db)
    scen = (
        db.query(Scenario)
        .filter(
            (Scenario.scenario_id == scenario_id)
            | (Scenario.id == scenario_id if scenario_id.isdigit() else False)
        )
        .first()
    )
    if not scen:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario '{scenario_id}' not found",
        )
    return scen
