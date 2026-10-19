from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.report import (
    SummaryReportResponse,
    SimulationRunReportResponse,
    SimulationHistoryPaginationResponse,
)
from app.services import simulation_service

router = APIRouter()


@router.get("/summary", response_model=SummaryReportResponse, tags=["Reports"])
def get_summary_report(db: Session = Depends(get_db)):
    """Retrieve an aggregated report of network topology health, simulation success rates, and active alerts."""
    return simulation_service.get_summary_report(db)


@router.get("/history", response_model=SimulationHistoryPaginationResponse, tags=["Reports"])
def get_simulation_history(
    search: Optional[str] = Query(None, description="Search term for Run ID or Scenario Name"),
    status: Optional[str] = Query(None, description="Filter by outcome status (SUCCESS, FAILED, STOPPED, ALL)"),
    page: int = Query(1, ge=1, description="Page number starting at 1"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    """Retrieve searchable, paginated simulation run history with real execution metrics."""
    skip = (page - 1) * page_size
    return simulation_service.get_simulation_history(
        db=db,
        search=search,
        status_filter=status,
        skip=skip,
        limit=page_size,
    )


@router.get("/simulations/{run_id}", response_model=SimulationRunReportResponse, tags=["Reports"])
def get_simulation_run_report(run_id: str, db: Session = Depends(get_db)):
    """Retrieve an engineering post-mortem assessment and event audit for a specific simulation drill."""
    return simulation_service.get_simulation_report(db=db, run_id=run_id)


@router.get("/export/csv", tags=["Reports"])
def export_simulation_history_csv(db: Session = Depends(get_db)):
    """Export the complete historical record of simulation drills as a CSV document."""
    csv_content = simulation_service.export_simulation_history_csv(db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=simulation_history.csv"},
    )


@router.get("/export/json/{run_id}", tags=["Reports"])
def export_simulation_detail_json(run_id: str, db: Session = Depends(get_db)):
    """Export full diagnostic drill report data for a specific run in JSON format."""
    json_content = simulation_service.export_simulation_detail_json(db=db, run_id=run_id)
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename=simulation_{run_id}.json"},
    )

