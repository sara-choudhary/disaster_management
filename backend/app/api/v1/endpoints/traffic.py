from datetime import datetime
from typing import List, Dict, Any
import uuid
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.traffic_class import (
    QoSSimulationRequest,
    QoSSimulationResponse,
    TrafficClassResponse,
)
from app.services import qos_service
from app.services.seed_data import seed_database_idempotent
from app.models.traffic_class import TrafficClass

router = APIRouter()


@router.post(
    "/simulate",
    response_model=QoSSimulationResponse,
    status_code=status.HTTP_200_OK,
    tags=["Traffic & QoS"],
)
async def run_traffic_qos_simulation(
    payload: QoSSimulationRequest,
    db: Session = Depends(get_db),
):
    """
    Execute a deterministic Quality of Service (QoS) and traffic prioritization simulation.
    Models link bandwidth constraints, competing cross-traffic, and strict priority
    starvation-safeguard scheduling.
    """
    result = qos_service.simulate_traffic_qos(db=db, request=payload)
    await manager.broadcast_json({
        "event_id": f"EVT-TRF-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": datetime.utcnow().isoformat(),
        "event_type": "TRAFFIC_UPDATE",
        "event": "TRAFFIC_UPDATE",
        "severity": "WARNING" if result.packets_lost > 0 else "INFO",
        "resource_id": f"{payload.source_department}->{payload.destination_department}",
        "affected_resource": payload.source_department,
        "source_department": payload.source_department,
        "destination_department": payload.destination_department,
        "traffic_class": payload.traffic_class,
        "delivery_rate": result.delivery_ratio_pct,
        "latency_ms": result.estimated_latency_ms,
        "queue_delay_ms": result.queue_delay_ms,
        "packets_sent": result.packets_sent,
        "packets_delivered": result.packets_delivered,
        "packets_dropped": result.packets_lost,
        "link_utilization": result.link_utilization_pct,
        "bottleneck_link_id": result.bottleneck_link_id,
    })
    return result


@router.get(
    "/classes",
    response_model=List[TrafficClassResponse],
    tags=["Traffic & QoS"],
)
def get_traffic_classes(db: Session = Depends(get_db)):
    """Retrieve all available traffic priority classes."""
    seed_database_idempotent(db)
    return db.query(TrafficClass).order_by(TrafficClass.priority.asc()).all()


@router.get(
    "/architecture",
    response_model=Dict[str, Any],
    tags=["Traffic & QoS"],
)
def get_qos_architecture_details():
    """
    Retrieve educational documentation contrasting OSPF routing with QoS traffic scheduling.
    """
    return {
        "routing_role": (
            "OSPF (Open Shortest Path First) calculates and establishes the shortest topological path "
            "between source and destination endpoints using link costs, reachability matrices, and Dijkstra SPF."
        ),
        "qos_role": (
            "The Quality of Service (QoS) model controls packet queueing, bandwidth allocation, and "
            "transmission scheduling across bottleneck links along established paths during network congestion."
        ),
        "scheduling_policy": "Strict Priority with Starvation Safeguard (SP-SS)",
        "safeguards": "Low-priority traffic receives an 8% bandwidth starvation safeguard reservation under congestion.",
        "traffic_classes": [
            {
                "code": "CRITICAL",
                "name": "Ambulance Dispatch and Hospital Coordination",
                "priority": 1,
                "latency_budget": "20.0 ms",
            },
            {
                "code": "HIGH",
                "name": "Police and Fire Communication",
                "priority": 2,
                "latency_budget": "45.0 ms",
            },
            {
                "code": "NORMAL",
                "name": "Ordinary Departmental Communication",
                "priority": 3,
                "latency_budget": "100.0 ms",
            },
            {
                "code": "LOW",
                "name": "Administrative or Background Traffic",
                "priority": 4,
                "latency_budget": "250.0 ms",
            },
        ],
        "disclaimer": "All metrics are simulated estimates calculated by the backend mathematical queuing model.",
    }
