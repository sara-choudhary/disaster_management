from datetime import datetime, timedelta
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.core.database import get_db
from app.core.websocket import manager
from app.models.alert import Alert
from app.schemas.alert import AlertCreate, AlertResponse, AlertUpdate
from app.services.seed_data import seed_database_idempotent

router = APIRouter()


@router.get("", response_model=List[AlertResponse], tags=["Alerts"])
def list_alerts(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (ACTIVE, ACKNOWLEDGED, RESOLVED)"),
    severity: Optional[str] = Query(None, description="Filter by severity (LOW, INFO, MEDIUM, WARNING, HIGH, CRITICAL)"),
    category: Optional[str] = Query(None, description="Filter by category (CONNECTIVITY, ROUTING, CONGESTION, SECURITY, INFRASTRUCTURE, REACHABILITY)"),
    resource: Optional[str] = Query(None, description="Filter by affected resource"),
    time_range: Optional[str] = Query(None, description="Filter by time range: 15m, 1h, 6h, 24h, all"),
    db: Session = Depends(get_db),
):
    """Retrieve operational alerts and warnings with pagination and filtering."""
    seed_database_idempotent(db)
    query = db.query(Alert).order_by(desc(Alert.timestamp))

    if status_filter:
        query = query.filter(Alert.status == status_filter.upper())
    if severity:
        sev_clean = severity.upper()
        # Normalization
        if sev_clean in ["INFO", "LOW"]:
            query = query.filter(Alert.severity.in_(["INFO", "LOW"]))
        elif sev_clean in ["WARNING", "MEDIUM"]:
            query = query.filter(Alert.severity.in_(["WARNING", "MEDIUM"]))
        else:
            query = query.filter(Alert.severity == sev_clean)
    if category:
        query = query.filter(Alert.category == category.upper())
    if resource:
        query = query.filter(
            (Alert.affected_resource == resource)
            | (Alert.affected_resource.contains(resource))
            | (Alert.description.contains(resource))
        )
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
            query = query.filter(Alert.timestamp >= cutoff)

    return query.offset(skip).limit(limit).all()


@router.post("", response_model=AlertResponse, status_code=status.HTTP_201_CREATED, tags=["Alerts"])
async def create_alert(payload: AlertCreate, db: Session = Depends(get_db)):
    """Log an operational alert."""
    existing = db.query(Alert).filter(Alert.alert_id == payload.alert_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Alert '{payload.alert_id}' already exists",
        )
    alert = Alert(**payload.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)

    # Broadcast event via WebSocket
    await manager.broadcast_json({
        "event_id": f"EVT-ALT-{alert.alert_id}",
        "timestamp": alert.timestamp.isoformat(),
        "event_type": "ALERT_CREATED",
        "event": "ALERT_CREATED",
        "severity": alert.severity,
        "resource_id": alert.affected_resource or alert.alert_id,
        "affected_resource": alert.affected_resource or alert.alert_id,
        "alert_id": alert.alert_id,
        "title": alert.title,
        "status": alert.status,
        "category": alert.category,
        "description": alert.description,
    })

    return alert


@router.get("/export/csv", tags=["Alerts"])
def export_alerts_csv(db: Session = Depends(get_db)):
    """Export all operational alerts and incident logs as a CSV document."""
    from app.services import simulation_service
    csv_content = simulation_service.export_alerts_csv(db=db)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=alerts_incidents.csv"},
    )


@router.get("/export/json", tags=["Alerts"])
def export_alerts_json(db: Session = Depends(get_db)):
    """Export all operational alerts and incident logs in JSON format."""
    from app.services import simulation_service
    json_content = simulation_service.export_alerts_json(db=db)
    return Response(
        content=json_content,
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=alerts_incidents.json"},
    )


@router.patch("/{alert_id}", response_model=AlertResponse, tags=["Alerts"])
async def update_alert(alert_id: str, payload: AlertUpdate, db: Session = Depends(get_db)):
    """Acknowledge, resolve, or edit an alert by alert_id or database id."""
    alert = (
        db.query(Alert)
        .filter(
            (Alert.alert_id == alert_id)
            | (Alert.id == alert_id if alert_id.isdigit() else False)
        )
        .first()
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found",
        )
    for field, value in payload.model_dump(exclude_unset=True).items():
        if field == "status" and value:
            setattr(alert, field, value.upper())
        else:
            setattr(alert, field, value)

    alert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)

    evt_type = "ALERT_RESOLVED" if alert.status == "RESOLVED" else "ALERT_UPDATED"
    # Broadcast update via WebSocket
    await manager.broadcast_json({
        "event_id": f"EVT-ALT-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": evt_type,
        "event": evt_type,
        "severity": alert.severity,
        "resource_id": alert.affected_resource or alert.alert_id,
        "affected_resource": alert.affected_resource or alert.alert_id,
        "alert_id": alert.alert_id,
        "title": alert.title,
        "category": alert.category,
        "status": alert.status,
    })

    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse, tags=["Alerts"])
async def acknowledge_alert(alert_id: str, db: Session = Depends(get_db)):
    """Acknowledge an alert."""
    alert = (
        db.query(Alert)
        .filter(
            (Alert.alert_id == alert_id)
            | (Alert.id == alert_id if alert_id.isdigit() else False)
        )
        .first()
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found",
        )
    alert.status = "ACKNOWLEDGED"
    alert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)

    await manager.broadcast_json({
        "event_id": f"EVT-ALT-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": "ALERT_UPDATED",
        "event": "ALERT_UPDATED",
        "severity": alert.severity,
        "resource_id": alert.affected_resource or alert.alert_id,
        "affected_resource": alert.affected_resource or alert.alert_id,
        "alert_id": alert.alert_id,
        "title": alert.title,
        "category": alert.category,
        "status": "ACKNOWLEDGED",
    })
    return alert


@router.post("/{alert_id}/resolve", response_model=AlertResponse, tags=["Alerts"])
async def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    """Resolve an alert."""
    alert = (
        db.query(Alert)
        .filter(
            (Alert.alert_id == alert_id)
            | (Alert.id == alert_id if alert_id.isdigit() else False)
        )
        .first()
    )
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found",
        )
    alert.status = "RESOLVED"
    alert.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(alert)

    await manager.broadcast_json({
        "event_id": f"EVT-ALT-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": "ALERT_RESOLVED",
        "event": "ALERT_RESOLVED",
        "severity": alert.severity,
        "resource_id": alert.affected_resource or alert.alert_id,
        "affected_resource": alert.affected_resource or alert.alert_id,
        "alert_id": alert.alert_id,
        "title": alert.title,
        "category": alert.category,
        "status": "RESOLVED",
    })
    return alert
