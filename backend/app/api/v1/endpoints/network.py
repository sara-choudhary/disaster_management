from datetime import datetime
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.node import NodeResponse
from app.schemas.link import NetworkLinkResponse
from app.schemas.department import DepartmentResponse
from app.schemas.network import (
    NetworkTopologyResponse,
    NetworkMetricsResponse,
    RoutePathResponse,
    RoutingTableResponse,
    FailureReasonPayload,
    LinkActionResponse,
    NodeActionResponse,
    BaselineResetResponse,
    ReachabilityMatrixResponse,
)
from app.schemas.telemetry import TelemetryResponse
from app.services import network_service, telemetry_service

router = APIRouter()


@router.get("/topology", response_model=NetworkTopologyResponse, tags=["Network"])
def get_network_topology(db: Session = Depends(get_db)):
    """Retrieve the complete network topology including nodes, links, and operational metrics."""
    return network_service.get_topology(db)


@router.get("/nodes", response_model=List[NodeResponse], tags=["Network"])
def list_network_nodes(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    status: Optional[str] = Query(None, description="Filter by node status (active, degraded, offline)"),
    department: Optional[str] = Query(None, description="Filter by department name"),
    db: Session = Depends(get_db),
):
    """Retrieve network devices and repeaters with pagination and filtering."""
    nodes = network_service.get_nodes(
        db=db,
        skip=skip,
        limit=limit,
        status_filter=status,
        department=department,
    )
    return [NodeResponse.model_validate(n) for n in nodes]


@router.get("/links", response_model=List[NetworkLinkResponse], tags=["Network"])
def list_network_links(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    operational_state: Optional[str] = Query(None, description="Filter by operational state (UP, DEGRADED, DOWN)"),
    db: Session = Depends(get_db),
):
    """Retrieve peer links between stations with pagination and filtering."""
    links = network_service.get_links(
        db=db,
        skip=skip,
        limit=limit,
        operational_state=operational_state,
    )
    return [NetworkLinkResponse.model_validate(l) for l in links]


@router.get("/departments", response_model=List[DepartmentResponse], tags=["Network"])
def list_network_departments(db: Session = Depends(get_db)):
    """Retrieve all municipal and emergency service departments."""
    departments = network_service.get_departments(db)
    return [DepartmentResponse.model_validate(d) for d in departments]


@router.get("/routes", response_model=RoutePathResponse, tags=["Network"])
def calculate_network_route(
    source: Optional[str] = Query("ECC-01", description="Source station ID"),
    destination: Optional[str] = Query("HOSPITAL-04", description="Destination station ID"),
    priority: Optional[str] = Query("CRITICAL_SOS", description="QoS priority routing policy"),
    db: Session = Depends(get_db),
):
    """Calculate the deterministic optimal route between two stations based on link latency and battery."""
    return network_service.calculate_route(
        db=db,
        source=source,
        destination=destination,
        priority=priority,
    )


@router.get("/routes/tables/{node_id}", response_model=RoutingTableResponse, tags=["Network"])
def get_node_routing_table(node_id: str, db: Session = Depends(get_db)):
    """Retrieve full OSPF-style converged routing table for a given router or endpoint."""
    return network_service.get_routing_table(db, node_id)



@router.get("/metrics", response_model=NetworkMetricsResponse, tags=["Network"])
def get_network_metrics(db: Session = Depends(get_db)):
    """Retrieve real-time network health metrics, uptime rates, and alert counts."""
    return network_service.get_metrics(db)


@router.get("/telemetry", response_model=TelemetryResponse, tags=["Network"])
def get_network_telemetry(
    time_range: str = Query("24h", description="Time range filter: 15m, 1h, 6h, 24h, all"),
    db: Session = Depends(get_db),
):
    """Retrieve modeled network telemetry time-series and health metrics."""
    return telemetry_service.get_telemetry_data(db=db, time_range=time_range)


@router.post(
    "/links/{link_id}/failure",
    response_model=LinkActionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
async def trigger_link_failure(
    link_id: str,
    payload: Optional[FailureReasonPayload] = None,
    db: Session = Depends(get_db),
):
    """Simulate a link severance/failure. Broadcasts real-time event to WebSocket subscribers."""
    reason = payload.reason if payload else "Simulated physical fiber/radio failure"
    link, event, action_res = network_service.fail_link(db=db, link_id=link_id, reason=reason)

    now_iso = datetime.utcnow().isoformat()
    # 1. Main failure event
    await manager.broadcast_json({
        "event_id": event.event_id,
        "timestamp": now_iso,
        "event_type": "LINK_FAILURE",
        "event": "LINK_FAILURE",
        "severity": "CRITICAL",
        "resource_id": link.link_id,
        "affected_resource": link.link_id,
        "resource_type": "link",
        "action": "FAILED",
        "operational_state": link.operational_state,
        "message": event.message,
        "recovery_metrics": action_res.recovery_metrics.model_dump() if action_res.recovery_metrics else None,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "alternate_path_selected": action_res.alternate_path_selected,
        "route_changes": action_res.route_changes,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 2. Structured Route Recalculation event
    await manager.broadcast_json({
        "event_id": f"EVT-RTE-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "ROUTE_RECALCULATION",
        "event": "ROUTE_RECALCULATION",
        "severity": "WARNING" if action_res.alternate_path_selected else "INFO",
        "resource_id": link.link_id,
        "affected_resource": link.link_id,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "route_changes": action_res.route_changes,
        "alternate_path_selected": action_res.alternate_path_selected,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 3. Structured Connectivity Change event
    await manager.broadcast_json({
        "event_id": f"EVT-CONN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "CONNECTIVITY_CHANGE",
        "event": "CONNECTIVITY_CHANGE",
        "severity": "CRITICAL" if any(not r for r in action_res.reachability.values()) else "INFO",
        "resource_id": link.link_id,
        "affected_resource": link.link_id,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    return action_res


@router.post(
    "/links/{link_id}/restore",
    response_model=LinkActionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
async def trigger_link_restore(
    link_id: str,
    db: Session = Depends(get_db),
):
    """Restore a failed link to operational UP state. Broadcasts to WebSocket subscribers."""
    link, event, action_res = network_service.restore_link(db=db, link_id=link_id)
    now_iso = datetime.utcnow().isoformat()

    # 1. Main restoration event
    await manager.broadcast_json({
        "event_id": event.event_id,
        "timestamp": now_iso,
        "event_type": "RESOURCE_RESTORED",
        "secondary_type": "LINK_RESTORED",
        "event": "LINK_RESTORED",
        "severity": "INFO",
        "resource_id": link.link_id,
        "affected_resource": link.link_id,
        "resource_type": "link",
        "action": "RESTORED",
        "operational_state": link.operational_state,
        "message": event.message,
        "recovery_metrics": action_res.recovery_metrics.model_dump() if action_res.recovery_metrics else None,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "alternate_path_selected": action_res.alternate_path_selected,
        "route_changes": action_res.route_changes,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 2. Structured Route Recalculation event
    await manager.broadcast_json({
        "event_id": f"EVT-RTE-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "ROUTE_RECALCULATION",
        "event": "ROUTE_RECALCULATION",
        "severity": "INFO",
        "resource_id": link.link_id,
        "affected_resource": link.link_id,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "route_changes": action_res.route_changes,
        "alternate_path_selected": action_res.alternate_path_selected,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 3. Structured Connectivity Change event
    await manager.broadcast_json({
        "event_id": f"EVT-CONN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "CONNECTIVITY_CHANGE",
        "event": "CONNECTIVITY_CHANGE",
        "severity": "INFO",
        "resource_id": link.link_id,
        "affected_resource": link.link_id,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    return action_res


@router.post(
    "/nodes/{node_id}/failure",
    response_model=NodeActionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
async def trigger_node_failure(
    node_id: str,
    payload: Optional[FailureReasonPayload] = None,
    db: Session = Depends(get_db),
):
    """Simulate a node/repeater failure. Broadcasts real-time event to WebSocket subscribers."""
    reason = payload.reason if payload else "Simulated node outage / power loss"
    node, event, action_res = network_service.fail_node(db=db, node_id=node_id, reason=reason)
    now_iso = datetime.utcnow().isoformat()

    # 1. Main failure event
    await manager.broadcast_json({
        "event_id": event.event_id,
        "timestamp": now_iso,
        "event_type": "NODE_FAILURE",
        "event": "NODE_FAILURE",
        "severity": "CRITICAL",
        "resource_id": node.node_id,
        "affected_resource": node.node_id,
        "resource_type": "node",
        "action": "FAILED",
        "status": node.status,
        "message": event.message,
        "recovery_metrics": action_res.recovery_metrics.model_dump() if action_res.recovery_metrics else None,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "alternate_path_selected": action_res.alternate_path_selected,
        "route_changes": action_res.route_changes,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 2. Structured Route Recalculation event
    await manager.broadcast_json({
        "event_id": f"EVT-RTE-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "ROUTE_RECALCULATION",
        "event": "ROUTE_RECALCULATION",
        "severity": "WARNING" if action_res.alternate_path_selected else "INFO",
        "resource_id": node.node_id,
        "affected_resource": node.node_id,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "route_changes": action_res.route_changes,
        "alternate_path_selected": action_res.alternate_path_selected,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 3. Structured Connectivity Change event
    await manager.broadcast_json({
        "event_id": f"EVT-CONN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "CONNECTIVITY_CHANGE",
        "event": "CONNECTIVITY_CHANGE",
        "severity": "CRITICAL" if any(not r for r in action_res.reachability.values()) else "INFO",
        "resource_id": node.node_id,
        "affected_resource": node.node_id,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    return action_res


@router.post(
    "/nodes/{node_id}/restore",
    response_model=NodeActionResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
async def trigger_node_restore(
    node_id: str,
    db: Session = Depends(get_db),
):
    """Restore a failed node back to active operational status. Broadcasts to WebSocket subscribers."""
    node, event, action_res = network_service.restore_node(db=db, node_id=node_id)
    now_iso = datetime.utcnow().isoformat()

    # 1. Main restoration event
    await manager.broadcast_json({
        "event_id": event.event_id,
        "timestamp": now_iso,
        "event_type": "RESOURCE_RESTORED",
        "secondary_type": "NODE_RESTORED",
        "event": "NODE_RESTORED",
        "severity": "INFO",
        "resource_id": node.node_id,
        "affected_resource": node.node_id,
        "resource_type": "node",
        "action": "RESTORED",
        "status": node.status,
        "message": event.message,
        "recovery_metrics": action_res.recovery_metrics.model_dump() if action_res.recovery_metrics else None,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "alternate_path_selected": action_res.alternate_path_selected,
        "route_changes": action_res.route_changes,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 2. Structured Route Recalculation event
    await manager.broadcast_json({
        "event_id": f"EVT-RTE-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "ROUTE_RECALCULATION",
        "event": "ROUTE_RECALCULATION",
        "severity": "INFO",
        "resource_id": node.node_id,
        "affected_resource": node.node_id,
        "before_path": action_res.before_path,
        "after_path": action_res.after_path,
        "route_changes": action_res.route_changes,
        "alternate_path_selected": action_res.alternate_path_selected,
        "simulation_run_id": action_res.simulation_run_id,
    })

    # 3. Structured Connectivity Change event
    await manager.broadcast_json({
        "event_id": f"EVT-CONN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "CONNECTIVITY_CHANGE",
        "event": "CONNECTIVITY_CHANGE",
        "severity": "INFO",
        "resource_id": node.node_id,
        "affected_resource": node.node_id,
        "reachability": action_res.reachability,
        "simulation_run_id": action_res.simulation_run_id,
    })

    return action_res


@router.post(
    "/reset",
    response_model=BaselineResetResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
@router.post(
    "/restore",
    response_model=BaselineResetResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
async def reset_network_baseline(db: Session = Depends(get_db)):
    """Controlled baseline reset: restores default topology state while preserving historical runs."""
    reset_res = network_service.reset_baseline_network(db=db)
    now_iso = datetime.utcnow().isoformat()

    # 1. Main restoration event
    await manager.broadcast_json({
        "event_id": f"EVT-RST-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "RESOURCE_RESTORED",
        "secondary_type": "BASELINE_RESET",
        "event": "BASELINE_RESET",
        "severity": "INFO",
        "resource_id": "NETWORK_TOPOLOGY",
        "affected_resource": "NETWORK_TOPOLOGY",
        "message": reset_res.message,
        "restored_nodes_count": reset_res.restored_nodes_count,
        "restored_links_count": reset_res.restored_links_count,
        "resolved_alerts_count": reset_res.resolved_alerts_count,
    })

    # 2. Connectivity change notification
    await manager.broadcast_json({
        "event_id": f"EVT-CONN-{uuid.uuid4().hex[:8].upper()}",
        "timestamp": now_iso,
        "event_type": "CONNECTIVITY_CHANGE",
        "event": "CONNECTIVITY_CHANGE",
        "severity": "INFO",
        "resource_id": "NETWORK_TOPOLOGY",
        "affected_resource": "NETWORK_TOPOLOGY",
        "message": "All network links and routing paths restored to baseline.",
    })

    return reset_res


@router.get(
    "/reachability",
    response_model=ReachabilityMatrixResponse,
    status_code=status.HTTP_200_OK,
    tags=["Network"],
)
def get_network_reachability(
    source_node_id: Optional[str] = Query("HQ-COMMAND-01", description="Source station ID to evaluate reachability from"),
    db: Session = Depends(get_db),
):
    """Retrieve reachability matrix and shortest paths to all destinations."""
    return network_service.get_reachability_matrix(db=db, source_node_id=source_node_id)

