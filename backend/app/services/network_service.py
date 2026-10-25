import uuid
import time
import threading
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from fastapi import HTTPException, status

from app.models.node import NetworkNode
from app.models.link import NetworkLink
from app.models.department import Department
from app.models.event import NetworkEvent
from app.models.alert import Alert
from app.models.simulation import SimulationRun
from app.schemas.network import (
    NetworkTopologyResponse,
    NetworkMetricsResponse,
    RoutePathResponse,
    RecoveryMetrics,
    FailureInjectionResponse,
    LinkActionResponse,
    NodeActionResponse,
    BaselineResetResponse,
    ReachabilityMatrixResponse,
)
from app.schemas.node import NodeResponse
from app.schemas.link import NetworkLinkResponse
from app.schemas.department import DepartmentResponse
from app.services.seed_data import seed_database_idempotent
from app.services.simulation import DeterministicNetworkRouter

network_state_lock = threading.Lock()



def get_topology(db: Session) -> NetworkTopologyResponse:
    """Return the complete topological mesh including nodes, links, and live metrics."""
    seed_database_idempotent(db)
    nodes = db.query(NetworkNode).all()
    links = db.query(NetworkLink).all()
    departments = db.query(Department).order_by(Department.priority.asc()).all()
    metrics = get_metrics(db)

    subnets = [
        {
            "department": d.name,
            "code": d.code,
            "subnet": d.subnet,
            "gateway": d.gateway,
            "vlan_id": d.vlan_id,
        }
        for d in departments
    ]

    return NetworkTopologyResponse(
        nodes=[NodeResponse.model_validate(n) for n in nodes],
        links=[NetworkLinkResponse.model_validate(l) for l in links],
        departments=[DepartmentResponse.model_validate(d) for d in departments],
        metrics=metrics.model_dump(),
        subnets=subnets,
        status="ok",
    )



def get_nodes(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status_filter: Optional[str] = None,
    department: Optional[str] = None,
) -> List[NetworkNode]:
    """Retrieve nodes with optional pagination and filtering."""
    seed_database_idempotent(db)
    query = db.query(NetworkNode)
    if status_filter:
        query = query.filter(NetworkNode.status == status_filter.lower())
    if department:
        query = query.filter(NetworkNode.department == department)
    return query.offset(skip).limit(limit).all()


def get_links(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    operational_state: Optional[str] = None,
) -> List[NetworkLink]:
    """Retrieve links with optional pagination and filtering."""
    seed_database_idempotent(db)
    query = db.query(NetworkLink)
    if operational_state:
        query = query.filter(NetworkLink.operational_state == operational_state.upper())
    return query.offset(skip).limit(limit).all()


def get_departments(db: Session) -> List[Department]:
    """Retrieve all emergency agency departments."""
    seed_database_idempotent(db)
    return db.query(Department).order_by(Department.priority.asc()).all()


def get_metrics(db: Session) -> NetworkMetricsResponse:
    """Calculate real-time operational network metrics and health scoring."""
    seed_database_idempotent(db)
    total_nodes = db.query(NetworkNode).count()
    active_nodes = db.query(NetworkNode).filter(NetworkNode.status == "active").count()
    offline_nodes = db.query(NetworkNode).filter(NetworkNode.status == "offline").count()
    degraded_nodes = db.query(NetworkNode).filter(NetworkNode.status == "degraded").count()

    total_links = db.query(NetworkLink).count()
    up_links = db.query(NetworkLink).filter(NetworkLink.operational_state == "UP").count()
    down_links = db.query(NetworkLink).filter(NetworkLink.operational_state == "DOWN").count()
    degraded_links = db.query(NetworkLink).filter(NetworkLink.operational_state == "DEGRADED").count()

    avg_latency = (
        db.query(func.avg(NetworkLink.latency))
        .filter(NetworkLink.operational_state != "DOWN")
        .scalar()
        or 0.0
    )

    total_bandwidth = (
        db.query(func.sum(NetworkLink.bandwidth))
        .filter(NetworkLink.operational_state != "DOWN")
        .scalar()
        or 0.0
    )

    # Health score computation (0 - 100): weighted active nodes and UP links
    node_ratio = (active_nodes / total_nodes) if total_nodes > 0 else 1.0
    link_ratio = (up_links / total_links) if total_links > 0 else 1.0
    health_score = round((node_ratio * 60.0) + (link_ratio * 40.0), 1)

    active_alerts = db.query(Alert).filter(Alert.status == "ACTIVE").count()

    return NetworkMetricsResponse(
        total_nodes=total_nodes,
        active_nodes=active_nodes,
        offline_nodes=offline_nodes,
        degraded_nodes=degraded_nodes,
        total_links=total_links,
        up_links=up_links,
        down_links=down_links,
        degraded_links=degraded_links,
        average_latency_ms=round(float(avg_latency), 2),
        total_bandwidth_mbps=round(float(total_bandwidth), 2),
        network_health_score=health_score,
        active_alerts_count=active_alerts,
    )


def resolve_node_id(nodes_dict: Dict[str, NetworkNode], identifier: Optional[str]) -> Optional[str]:
    """Resolve node identifier, device_id, or common department alias to exact node_id."""
    if not identifier:
        return None
    if identifier in nodes_dict:
        return identifier
    for nid, node in nodes_dict.items():
        if getattr(node, "device_id", None) == identifier:
            return nid
    ident_lower = identifier.lower().replace("-", "").replace("_", "")
    alias_map = {
        "ecc": "HQ-COMMAND-01",
        "ecc01": "HQ-COMMAND-01",
        "hqcommand01": "HQ-COMMAND-01",
        "police": "POLICE-02",
        "police02": "POLICE-02",
        "fire": "FIRE-03",
        "fire03": "FIRE-03",
        "hospital": "HOSPITAL-TRIAGE-03",
        "hospital04": "HOSPITAL-TRIAGE-03",
        "hospitaltriage03": "HOSPITAL-TRIAGE-03",
        "ambulance": "AMBULANCE-05",
        "ambulance05": "AMBULANCE-05",
        "relief": "SHELTER-SOUTH-05",
        "shelter": "SHELTER-SOUTH-05",
        "sheltersouth05": "SHELTER-SOUTH-05",
        "backup": "BACKUP-CC-07",
        "backupcc07": "BACKUP-CC-07",
        "relayn": "RELAY-NORTH-02",
        "relaynorth02": "RELAY-NORTH-02",
        "relayv": "RELAY-VALLEY-04",
        "relayvalley04": "RELAY-VALLEY-04",
    }
    if ident_lower in alias_map and alias_map[ident_lower] in nodes_dict:
        return alias_map[ident_lower]
    for nid, node in nodes_dict.items():
        if identifier.lower() in node.name.lower() or identifier.lower() in node.department.lower():
            return nid
    return None


from app.services.routing_engine import OSPFRoutingEngine


def build_routing_engine(db: Session) -> OSPFRoutingEngine:
    """Build an independent OSPF-inspired routing engine graph from database nodes and links."""
    engine = OSPFRoutingEngine()
    nodes = db.query(NetworkNode).all()
    links = db.query(NetworkLink).all()

    for n in nodes:
        engine.add_node(
            node_id=n.node_id,
            name=n.name,
            node_type=n.node_type,
            status=n.status,
            ip_address=n.ip_address,
            extra_metadata=n.extra_metadata,
        )

    for l in links:
        engine.add_link(
            link_id=l.link_id,
            source=l.source_node_id,
            destination=l.destination_node_id,
            cost=l.link_cost,
            operational_state=l.operational_state,
            bandwidth=l.bandwidth,
            latency=l.latency,
            link_type=l.link_type,
            bidirectional=True,
            extra_metadata=l.extra_metadata,
        )

    return engine


def calculate_route(
    db: Session,
    source: Optional[str] = None,
    destination: Optional[str] = None,
    priority: str = "CRITICAL_SOS",
) -> RoutePathResponse:
    """Calculate the deterministic optimal route between two nodes under current network conditions using Dijkstra SPF."""
    seed_database_idempotent(db)
    nodes_dict = {n.node_id: n for n in db.query(NetworkNode).all()}

    resolved_src = resolve_node_id(nodes_dict, source or "HQ-COMMAND-01")
    resolved_dest = resolve_node_id(nodes_dict, destination or "HOSPITAL-TRIAGE-03")

    if not resolved_src:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source node '{source}' not found",
        )
    if not resolved_dest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination node '{destination}' not found",
        )

    src = resolved_src
    dest = resolved_dest

    engine = build_routing_engine(db)
    result = engine.calculate_shortest_path(src, dest)

    est_latency = (
        round(sum(h.latency_ms for h in result.hop_list), 2)
        if result.reachable and result.hop_list
        else 0.0
    )

    return RoutePathResponse(
        source=source or src,
        destination=destination or dest,
        priority=priority,
        path_exists=result.reachable,
        reachability=result.reachable,
        status="OPTIMAL" if result.reachable else "UNREACHABLE",
        hops=len(result.selected_path) - 1 if result.reachable else 0,
        cost=result.total_cost if (result.reachable and result.total_cost < float("inf")) else None,
        estimated_latency_ms=est_latency,
        path=result.selected_path,
        next_hop=result.next_hop,
        hop_list=[h.model_dump() for h in result.hop_list],
        alternate_path_selected=result.alternate_path_selected,
        route_changes=result.route_changes,
        algorithm=result.algorithm,
    )


def get_routing_table(db: Session, node_id: str) -> Dict[str, Any]:
    """Retrieve the complete OSPF-style converged routing table for a given router or node."""
    seed_database_idempotent(db)
    nodes_dict = {n.node_id: n for n in db.query(NetworkNode).all()}
    resolved_id = resolve_node_id(nodes_dict, node_id)
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Node '{node_id}' not found",
        )

    engine = build_routing_engine(db)
    table = engine.generate_routing_table(resolved_id)
    return {
        "node_id": resolved_id,
        "entries_count": len(table),
        "table": {k: v.model_dump() for k, v in table.items()},
    }


def compare_routing_algorithms(
    db: Session,
    source: Optional[str] = "HQ-COMMAND-01",
    destination: Optional[str] = "HOSPITAL-TRIAGE-03",
    k_paths: int = 3,
) -> Dict[str, Any]:
    """Execute and compare Dijkstra, Bellman-Ford, Floyd-Warshall, and Yen's K-Shortest."""
    seed_database_idempotent(db)
    nodes_dict = {n.node_id: n for n in db.query(NetworkNode).all()}

    resolved_src = resolve_node_id(nodes_dict, source or "HQ-COMMAND-01")
    resolved_dest = resolve_node_id(nodes_dict, destination or "HOSPITAL-TRIAGE-03")

    if not resolved_src:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Source node '{source}' not found",
        )
    if not resolved_dest:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Destination node '{destination}' not found",
        )

    engine = build_routing_engine(db)
    return engine.compare_algorithms(resolved_src, resolved_dest, K=max(1, min(5, k_paths)))





def compute_modeled_recovery_metrics(
    spf_duration_ms: float,
    hop_latency_ms: float,
    num_recalculated_routes: int,
    reachable_count: int,
    total_count: int,
) -> RecoveryMetrics:
    """
    Modeled failure detection, shortest path recalculation, hardware FIB programming,
    and path propagation delay system. Recovery timing is calculated dynamically from
    actual SPF execution and network link properties rather than hard-coded.
    """
    # 1. BFD (Bidirectional Forwarding Detection) 3 x 15ms keepalive detection timeout
    detection_delay_ms = 45.0
    # 2. High-resolution measured Dijkstra SPF calculation delay
    spf_calculation_ms = round(max(spf_duration_ms, 0.05), 3)
    # 3. Hardware Forwarding Information Base (FIB) update latency (2.5ms per route prefix)
    fib_update_ms = round(max(num_recalculated_routes * 2.5, 2.5), 2)
    # 4. Modeled Path propagation delay across selected hops
    propagation_delay_ms = round(max(hop_latency_ms, 0.0), 2)

    total_ms = detection_delay_ms + spf_calculation_ms + fib_update_ms + propagation_delay_ms
    total_recovery_duration_sec = round(total_ms / 1000.0, 4)
    reachability_pct = round((reachable_count / total_count * 100.0), 1) if total_count > 0 else 0.0

    return RecoveryMetrics(
        detection_delay_ms=detection_delay_ms,
        spf_calculation_ms=spf_calculation_ms,
        fib_update_ms=fib_update_ms,
        propagation_delay_ms=propagation_delay_ms,
        total_recovery_duration_sec=total_recovery_duration_sec,
        reachability_percentage=reachability_pct,
        timing_model="BFD (3x Keepalive) + Dijkstra SPF + Hardware FIB + Path Propagation Delay",
    )


def get_department_endpoint_ids(db: Session) -> List[str]:
    """Retrieve node IDs for departmental endpoints and servers."""
    dept_nodes = (
        db.query(NetworkNode.node_id)
        .filter(NetworkNode.node_type.in_(["endpoint", "server"]))
        .all()
    )
    if dept_nodes:
        return [n[0] for n in dept_nodes]
    return [
        "HQ-COMMAND-01",
        "POLICE-02",
        "FIRE-03",
        "HOSPITAL-TRIAGE-03",
        "AMBULANCE-05",
        "SHELTER-SOUTH-05",
        "BACKUP-CC-07",
    ]


def fail_link(
    db: Session,
    link_id: str,
    reason: Optional[str] = None,
) -> Tuple[NetworkLink, NetworkEvent, LinkActionResponse]:
    """
    Execute complete 9-step failure workflow for network links:
    1. Record initial network state.
    2. Mark the link as unavailable.
    3. Recalculate routes with measured Dijkstra SPF timer.
    4. Re-evaluate endpoint reachability across all departments.
    5. Record route changes (alternate route selection).
    6. Calculate interruption and recovery metrics using modeled timing.
    7. Generate relevant active alerts.
    8. Persist simulation results (SimulationRun) and audit event.
    9. Return full action response for WebSocket broadcast.
    """
    with network_state_lock:
        link = db.query(NetworkLink).filter(NetworkLink.link_id == link_id).first()
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link '{link_id}' not found",
            )

        # 1. Record initial network state
        initial_nodes = [n.node_id for n in db.query(NetworkNode).filter(NetworkNode.status == "active").all()]
        initial_links = [l.link_id for l in db.query(NetworkLink).filter(NetworkLink.operational_state == "UP").all()]
        initial_state = {
            "active_nodes_count": len(initial_nodes),
            "up_links_count": len(initial_links),
            "failed_resource": link_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        engine_before = build_routing_engine(db)
        route_before = engine_before.calculate_shortest_path(link.source_node_id, link.destination_node_id)
        before_path = route_before.selected_path if route_before.reachable else []

        # 2. Mark the link as unavailable
        link.operational_state = "DOWN"
        now = datetime.utcnow()
        reason_str = reason or "Link failure triggered by simulation/operator drill"

        # 3. Recalculate routes with high-resolution timer
        t_start = time.perf_counter()
        engine_after = build_routing_engine(db)
        route_after = engine_after.calculate_shortest_path(link.source_node_id, link.destination_node_id)
        t_end = time.perf_counter()
        spf_duration_ms = (t_end - t_start) * 1000.0
        after_path = route_after.selected_path if route_after.reachable else []

        # 4. Re-evaluate endpoint reachability across all department endpoints
        dept_ids = get_department_endpoint_ids(db)
        reachability: Dict[str, bool] = {}
        reachable_count = 0
        src_for_reachability = "HQ-COMMAND-01"
        for dept in dept_ids:
            if dept == src_for_reachability:
                reachability[dept] = True
                reachable_count += 1
            else:
                is_reach = engine_after.check_reachability(src_for_reachability, dept)
                reachability[dept] = is_reach
                if is_reach:
                    reachable_count += 1

        # 5. Record route changes
        route_changes = list(route_after.route_changes)
        alternate_selected = False
        if before_path and after_path and before_path != after_path:
            alternate_selected = True
            route_changes.append(
                f"Rerouted {link.source_node_id} -> {link.destination_node_id}: [{' -> '.join(before_path)}] rerouted to alternate path [{' -> '.join(after_path)}]"
            )
        elif not after_path and before_path:
            route_changes.append(
                f"Direct and alternate routes severed between {link.source_node_id} and {link.destination_node_id}. Destination is unreachable."
            )

        # 6. Calculate interruption and recovery metrics using modeled timing system
        hop_latency = sum(h.latency_ms for h in route_after.hop_list) if route_after.reachable else 0.0
        recovery_metrics = compute_modeled_recovery_metrics(
            spf_duration_ms=spf_duration_ms,
            hop_latency_ms=hop_latency,
            num_recalculated_routes=len(dept_ids),
            reachable_count=reachable_count,
            total_count=len(dept_ids),
        )

        # 7. Generate relevant alerts and persist simulation run
        sim_run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        alert = Alert(
            alert_id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            severity="CRITICAL",
            category="CONNECTIVITY",
            title=f"Link Outage: {link_id}",
            description=f"Link {link_id} ({link.source_node_id} <-> {link.destination_node_id}) severed. Reason: {reason_str}",
            status="ACTIVE",
            affected_resource=link_id,
            related_run=sim_run_id,
            timestamp=now,
        )
        db.add(alert)

        if alternate_selected:
            db.add(
                Alert(
                    alert_id=f"ALT-REROUTE-{uuid.uuid4().hex[:8].upper()}",
                    severity="WARNING",
                    category="ROUTING",
                    title=f"Route Recalculated: {link.source_node_id} ➔ {link.destination_node_id}",
                    description=f"Primary link {link_id} severed. Dynamic OSPF-inspired rerouting activated alternate path: {' -> '.join(after_path)}",
                    status="ACTIVE",
                    affected_resource=link_id,
                    related_run=sim_run_id,
                    timestamp=now,
                )
            )

        if reachable_count < len(dept_ids):
            unreachable_list = [d for d, r in reachability.items() if not r]
            db.add(
                Alert(
                    alert_id=f"ALT-REACH-{uuid.uuid4().hex[:8].upper()}",
                    severity="CRITICAL",
                    category="REACHABILITY",
                    title=f"Loss of Department Reachability via {link_id}",
                    description=f"Severance of link {link_id} caused reachability loss to: {', '.join(unreachable_list)}.",
                    status="ACTIVE",
                    affected_resource=link_id,
                    related_run=sim_run_id,
                    timestamp=now,
                )
            )

        sim_result = "SUCCESS" if (route_after.reachable or reachable_count >= max(1, len(dept_ids) - 1)) else "FAILED"
        final_state = {
            "active_nodes_count": len(db.query(NetworkNode).filter(NetworkNode.status == "active").all()),
            "up_links_count": len(db.query(NetworkLink).filter(NetworkLink.operational_state == "UP").all()),
            "reachability": reachability,
            "alternate_path_selected": alternate_selected,
        }
        sim_run = SimulationRun(
            run_id=sim_run_id,
            scenario_id=f"DRILL-FAIL-{link_id}",
            start_time=now,
            end_time=now + timedelta(seconds=recovery_metrics.total_recovery_duration_sec),
            initial_state=initial_state,
            final_state=final_state,
            result=sim_result,
            recovery_duration=recovery_metrics.total_recovery_duration_sec,
            packet_statistics={
                "packet_loss_percent": 0.0 if route_after.reachable else 100.0,
                "recalculated_hops": len(after_path) - 1 if after_path else 0,
                "latency_ms": hop_latency,
                "reachability_percentage": recovery_metrics.reachability_percentage,
                "timing_breakdown": recovery_metrics.model_dump(),
            },
        )
        db.add(sim_run)

        # 9. Create NetworkEvent linked to related_run
        event = NetworkEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            timestamp=now,
            event_type="LINK_FAILURE",
            severity="CRITICAL",
            message=f"Link '{link_id}' ({link.source_node_id} <-> {link.destination_node_id}) went DOWN. Reason: {reason_str}",
            affected_resource=link_id,
            related_run=sim_run_id,
        )
        db.add(event)

        db.commit()
        db.refresh(link)
        db.refresh(event)

        action_response = LinkActionResponse(
            status="success",
            message=f"Link '{link_id}' marked as DOWN. Recovery time: {recovery_metrics.total_recovery_duration_sec}s",
            resource_id=link.link_id,
            resource_type="link",
            action="FAILED",
            link=NetworkLinkResponse.model_validate(link),
            recovery_metrics=recovery_metrics,
            before_path=before_path,
            after_path=after_path,
            alternate_path_selected=alternate_selected,
            route_changes=route_changes,
            reachability=reachability,
            simulation_run_id=sim_run_id,
        )

        return link, event, action_response


def restore_link(
    db: Session,
    link_id: str,
) -> Tuple[NetworkLink, NetworkEvent, LinkActionResponse]:
    """Execute complete restoration workflow for network links with concurrency lock."""
    with network_state_lock:
        link = db.query(NetworkLink).filter(NetworkLink.link_id == link_id).first()
        if not link:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Link '{link_id}' not found",
            )

        # Pre-restoration path
        engine_before = build_routing_engine(db)
        route_before = engine_before.calculate_shortest_path(link.source_node_id, link.destination_node_id)
        before_path = route_before.selected_path if route_before.reachable else []

        link.operational_state = "UP"
        now = datetime.utcnow()

        # Recalculate routes with timing
        t_start = time.perf_counter()
        engine_after = build_routing_engine(db)
        route_after = engine_after.calculate_shortest_path(link.source_node_id, link.destination_node_id)
        t_end = time.perf_counter()
        spf_duration_ms = (t_end - t_start) * 1000.0
        after_path = route_after.selected_path if route_after.reachable else []

        dept_ids = get_department_endpoint_ids(db)
        reachability: Dict[str, bool] = {}
        reachable_count = 0
        src_for_reachability = "HQ-COMMAND-01"
        for dept in dept_ids:
            if dept == src_for_reachability:
                reachability[dept] = True
                reachable_count += 1
            else:
                is_reach = engine_after.check_reachability(src_for_reachability, dept)
                reachability[dept] = is_reach
                if is_reach:
                    reachable_count += 1

        route_changes = list(route_after.route_changes)
        if before_path != after_path:
            route_changes.append(
                f"Path restored between {link.source_node_id} and {link.destination_node_id}: optimal primary route re-established via [{' -> '.join(after_path)}]"
            )

        hop_latency = sum(h.latency_ms for h in route_after.hop_list) if route_after.reachable else 0.0
        recovery_metrics = compute_modeled_recovery_metrics(
            spf_duration_ms=spf_duration_ms,
            hop_latency_ms=hop_latency,
            num_recalculated_routes=len(dept_ids),
            reachable_count=reachable_count,
            total_count=len(dept_ids),
        )

        # Resolve active alerts for this link
        active_alerts = (
            db.query(Alert)
            .filter(Alert.description.contains(link_id), Alert.status == "ACTIVE")
            .all()
        )
        for alt in active_alerts:
            alt.status = "RESOLVED"

        sim_run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        sim_run = SimulationRun(
            run_id=sim_run_id,
            scenario_id=f"DRILL-RESTORE-{link_id}",
            start_time=now,
            end_time=now + timedelta(seconds=recovery_metrics.total_recovery_duration_sec),
            initial_state={"link_state_before": "DOWN"},
            final_state={"link_state_after": "UP", "reachability": reachability},
            result="SUCCESS",
            recovery_duration=recovery_metrics.total_recovery_duration_sec,
            packet_statistics={
                "packet_loss_percent": 0.0,
                "recalculated_hops": len(after_path) - 1 if after_path else 0,
                "latency_ms": hop_latency,
                "timing_breakdown": recovery_metrics.model_dump(),
            },
        )
        db.add(sim_run)

        restored_alert = Alert(
            alert_id=f"ALT-RESTORE-{uuid.uuid4().hex[:8].upper()}",
            severity="INFO",
            category="CONNECTIVITY",
            title=f"Critical Connectivity Restored: {link_id}",
            description=f"Link '{link_id}' ({link.source_node_id} <-> {link.destination_node_id}) restored to operational state. Optimal primary route re-converged.",
            status="RESOLVED",
            affected_resource=link_id,
            related_run=sim_run_id,
            timestamp=now,
        )
        db.add(restored_alert)

        event = NetworkEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            timestamp=now,
            event_type="LINK_RESTORED",
            severity="INFO",
            message=f"Link '{link_id}' restored to operational UP state.",
            affected_resource=link_id,
            related_run=sim_run_id,
        )
        db.add(event)

        db.commit()
        db.refresh(link)
        db.refresh(event)

        action_response = LinkActionResponse(
            status="success",
            message=f"Link '{link_id}' restored to UP state",
            resource_id=link.link_id,
            resource_type="link",
            action="RESTORED",
            link=NetworkLinkResponse.model_validate(link),
            recovery_metrics=recovery_metrics,
            before_path=before_path,
            after_path=after_path,
            alternate_path_selected=False,
            route_changes=route_changes,
            reachability=reachability,
            simulation_run_id=sim_run_id,
        )

        return link, event, action_response


def fail_node(
    db: Session,
    node_id: str,
    reason: Optional[str] = None,
) -> Tuple[NetworkNode, NetworkEvent, NodeActionResponse]:
    """Execute complete 9-step failure workflow for network routers/nodes with concurrency lock."""
    with network_state_lock:
        node = (
            db.query(NetworkNode)
            .filter((NetworkNode.node_id == node_id) | (NetworkNode.device_id == node_id))
            .first()
        )
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node '{node_id}' not found",
            )

        # Pre-failure state
        initial_nodes = [n.node_id for n in db.query(NetworkNode).filter(NetworkNode.status == "active").all()]
        initial_links = [l.link_id for l in db.query(NetworkLink).filter(NetworkLink.operational_state == "UP").all()]
        initial_state = {
            "active_nodes_count": len(initial_nodes),
            "up_links_count": len(initial_links),
            "failed_resource": node.node_id,
            "timestamp": datetime.utcnow().isoformat(),
        }
        sample_src = "HQ-COMMAND-01" if node.node_id != "HQ-COMMAND-01" else "BACKUP-CC-07"
        sample_dst = node.node_id
        engine_before = build_routing_engine(db)
        route_before = engine_before.calculate_shortest_path(sample_src, sample_dst)
        before_path = route_before.selected_path if route_before.reachable else []

        node.status = "offline"
        now = datetime.utcnow()
        reason_str = reason or "Node offline failure triggered by operator drill"

        # Recalculate routes with timing
        t_start = time.perf_counter()
        engine_after = build_routing_engine(db)
        route_after = engine_after.calculate_shortest_path(sample_src, sample_dst)
        t_end = time.perf_counter()
        spf_duration_ms = (t_end - t_start) * 1000.0
        after_path = route_after.selected_path if route_after.reachable else []

        dept_ids = get_department_endpoint_ids(db)
        reachability: Dict[str, bool] = {}
        reachable_count = 0
        src_for_reachability = "HQ-COMMAND-01" if node.node_id != "HQ-COMMAND-01" else "BACKUP-CC-07"
        for dept in dept_ids:
            if dept == node.node_id:
                reachability[dept] = False
            elif dept == src_for_reachability:
                reachability[dept] = True
                reachable_count += 1
            else:
                is_reach = engine_after.check_reachability(src_for_reachability, dept)
                reachability[dept] = is_reach
                if is_reach:
                    reachable_count += 1

        route_changes = list(route_after.route_changes)
        alternate_selected = False
        if before_path and after_path and before_path != after_path:
            alternate_selected = True
            route_changes.append(
                f"Node outage caused reroute: [{' -> '.join(before_path)}] rerouted to alternate path [{' -> '.join(after_path)}]"
            )
        elif not after_path and before_path:
            route_changes.append(
                f"Path severed; destination unreachable due to offline node '{node.node_id}'."
            )

        hop_latency = sum(h.latency_ms for h in route_after.hop_list) if route_after.reachable else 0.0
        recovery_metrics = compute_modeled_recovery_metrics(
            spf_duration_ms=spf_duration_ms,
            hop_latency_ms=hop_latency,
            num_recalculated_routes=len(dept_ids),
            reachable_count=reachable_count,
            total_count=len(dept_ids),
        )

        sim_run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        alert = Alert(
            alert_id=f"ALT-{uuid.uuid4().hex[:8].upper()}",
            severity="CRITICAL",
            category="INFRASTRUCTURE",
            title=f"Node Offline: {node.name}",
            description=f"Node {node.node_id} ({node.department}) failed telemetry check. Reason: {reason_str}",
            status="ACTIVE",
            affected_resource=node.node_id,
            related_run=sim_run_id,
            timestamp=now,
        )
        db.add(alert)

        if alternate_selected:
            db.add(
                Alert(
                    alert_id=f"ALT-REROUTE-{uuid.uuid4().hex[:8].upper()}",
                    severity="WARNING",
                    category="ROUTING",
                    title=f"Route Recalculated around offline node {node.node_id}",
                    description=f"Traffic dynamically rerouted via alternate path around failed node {node.node_id}.",
                    status="ACTIVE",
                    affected_resource=node.node_id,
                    related_run=sim_run_id,
                    timestamp=now,
                )
            )

        if reachable_count < len(dept_ids):
            unreachable_list = [d for d, r in reachability.items() if not r]
            db.add(
                Alert(
                    alert_id=f"ALT-REACH-{uuid.uuid4().hex[:8].upper()}",
                    severity="CRITICAL",
                    category="REACHABILITY",
                    title=f"Loss of Department Reachability: Node {node.node_id}",
                    description=f"Outage of node {node.node_id} ({node.name}) caused reachability loss to: {', '.join(unreachable_list)}.",
                    status="ACTIVE",
                    affected_resource=node.node_id,
                    related_run=sim_run_id,
                    timestamp=now,
                )
            )

        sim_result = "SUCCESS" if (reachable_count == len(dept_ids)) else "FAILED"
        final_state = {
            "active_nodes_count": len(db.query(NetworkNode).filter(NetworkNode.status == "active").all()),
            "up_links_count": len(db.query(NetworkLink).filter(NetworkLink.operational_state == "UP").all()),
            "reachability": reachability,
            "alternate_path_selected": alternate_selected,
        }
        sim_run = SimulationRun(
            run_id=sim_run_id,
            scenario_id=f"DRILL-FAIL-NODE-{node.node_id}",
            start_time=now,
            end_time=now + timedelta(seconds=recovery_metrics.total_recovery_duration_sec),
            initial_state=initial_state,
            final_state=final_state,
            result=sim_result,
            recovery_duration=recovery_metrics.total_recovery_duration_sec,
            packet_statistics={
                "packet_loss_percent": 0.0 if route_after.reachable else 100.0,
                "recalculated_hops": len(after_path) - 1 if after_path else 0,
                "latency_ms": hop_latency,
                "reachability_percentage": recovery_metrics.reachability_percentage,
                "timing_breakdown": recovery_metrics.model_dump(),
            },
        )
        db.add(sim_run)

        event = NetworkEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            timestamp=now,
            event_type="NODE_FAILURE",
            severity="CRITICAL",
            message=f"Node '{node.node_id}' ({node.name}) went offline. Reason: {reason_str}",
            affected_resource=node.node_id,
            related_run=sim_run_id,
        )
        db.add(event)

        db.commit()
        db.refresh(node)
        db.refresh(event)

        action_response = NodeActionResponse(
            status="success",
            message=f"Node '{node_id}' marked as offline. Recovery time: {recovery_metrics.total_recovery_duration_sec}s",
            resource_id=node.node_id,
            resource_type="node",
            action="FAILED",
            node=NodeResponse.model_validate(node),
            recovery_metrics=recovery_metrics,
            before_path=before_path,
            after_path=after_path,
            alternate_path_selected=alternate_selected,
            route_changes=route_changes,
            reachability=reachability,
            simulation_run_id=sim_run_id,
        )

        return node, event, action_response


def restore_node(
    db: Session,
    node_id: str,
) -> Tuple[NetworkNode, NetworkEvent, NodeActionResponse]:
    """Execute complete restoration workflow for routers/nodes with concurrency lock."""
    with network_state_lock:
        node = (
            db.query(NetworkNode)
            .filter((NetworkNode.node_id == node_id) | (NetworkNode.device_id == node_id))
            .first()
        )
        if not node:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Node '{node_id}' not found",
            )

        engine_before = build_routing_engine(db)
        sample_src = "HQ-COMMAND-01" if node.node_id != "HQ-COMMAND-01" else "BACKUP-CC-07"
        sample_dst = node.node_id
        route_before = engine_before.calculate_shortest_path(sample_src, sample_dst)
        before_path = route_before.selected_path if route_before.reachable else []

        node.status = "active"
        now = datetime.utcnow()

        t_start = time.perf_counter()
        engine_after = build_routing_engine(db)
        route_after = engine_after.calculate_shortest_path(sample_src, sample_dst)
        t_end = time.perf_counter()
        spf_duration_ms = (t_end - t_start) * 1000.0
        after_path = route_after.selected_path if route_after.reachable else []

        dept_ids = get_department_endpoint_ids(db)
        reachability: Dict[str, bool] = {}
        reachable_count = 0
        src_for_reachability = "HQ-COMMAND-01"
        for dept in dept_ids:
            if dept == src_for_reachability:
                reachability[dept] = True
                reachable_count += 1
            else:
                is_reach = engine_after.check_reachability(src_for_reachability, dept)
                reachability[dept] = is_reach
                if is_reach:
                    reachable_count += 1

        route_changes = list(route_after.route_changes)
        if before_path != after_path:
            route_changes.append(
                f"Node '{node.node_id}' restored; optimal paths converged via [{' -> '.join(after_path)}]"
            )

        hop_latency = sum(h.latency_ms for h in route_after.hop_list) if route_after.reachable else 0.0
        recovery_metrics = compute_modeled_recovery_metrics(
            spf_duration_ms=spf_duration_ms,
            hop_latency_ms=hop_latency,
            num_recalculated_routes=len(dept_ids),
            reachable_count=reachable_count,
            total_count=len(dept_ids),
        )

        active_alerts = (
            db.query(Alert)
            .filter(Alert.description.contains(node.node_id), Alert.status == "ACTIVE")
            .all()
        )
        for alt in active_alerts:
            alt.status = "RESOLVED"

        sim_run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        sim_run = SimulationRun(
            run_id=sim_run_id,
            scenario_id=f"DRILL-RESTORE-NODE-{node.node_id}",
            start_time=now,
            end_time=now + timedelta(seconds=recovery_metrics.total_recovery_duration_sec),
            initial_state={"node_status_before": "offline"},
            final_state={"node_status_after": "active", "reachability": reachability},
            result="SUCCESS",
            recovery_duration=recovery_metrics.total_recovery_duration_sec,
            packet_statistics={
                "packet_loss_percent": 0.0,
                "recalculated_hops": len(after_path) - 1 if after_path else 0,
                "latency_ms": hop_latency,
                "timing_breakdown": recovery_metrics.model_dump(),
            },
        )
        db.add(sim_run)

        restored_alert = Alert(
            alert_id=f"ALT-RESTORE-{uuid.uuid4().hex[:8].upper()}",
            severity="INFO",
            category="INFRASTRUCTURE",
            title=f"Critical Node Restored: {node.name}",
            description=f"Node '{node.node_id}' ({node.name}) returned to operational active status. Routing reconverged.",
            status="RESOLVED",
            affected_resource=node.node_id,
            related_run=sim_run_id,
            timestamp=now,
        )
        db.add(restored_alert)

        event = NetworkEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            timestamp=now,
            event_type="NODE_RESTORED",
            severity="INFO",
            message=f"Node '{node.node_id}' ({node.name}) returned to active status.",
            affected_resource=node.node_id,
            related_run=sim_run_id,
        )
        db.add(event)

        db.commit()
        db.refresh(node)
        db.refresh(event)

        action_response = NodeActionResponse(
            status="success",
            message=f"Node '{node_id}' restored to active status",
            resource_id=node.node_id,
            resource_type="node",
            action="RESTORED",
            node=NodeResponse.model_validate(node),
            recovery_metrics=recovery_metrics,
            before_path=before_path,
            after_path=after_path,
            alternate_path_selected=False,
            route_changes=route_changes,
            reachability=reachability,
            simulation_run_id=sim_run_id,
        )

        return node, event, action_response


def reset_baseline_network(db: Session) -> BaselineResetResponse:
    """
    Controlled baseline reset that restores the intended default network configuration
    without deleting historical simulation runs or historical network events.
    """
    with network_state_lock:
        seed_database_idempotent(db)

        # 1. Restore all nodes to active
        nodes = db.query(NetworkNode).all()
        restored_nodes_count = 0
        for n in nodes:
            if n.status != "active":
                n.status = "active"
                restored_nodes_count += 1
            if n.battery_level < 80.0:
                n.battery_level = 100.0

        # 2. Restore all links to UP
        links = db.query(NetworkLink).all()
        restored_links_count = 0
        for l in links:
            if l.operational_state != "UP":
                l.operational_state = "UP"
                restored_links_count += 1

        # 3. Resolve active connectivity and node health alerts
        active_alerts = (
            db.query(Alert)
            .filter(Alert.status == "ACTIVE")
            .all()
        )
        resolved_alerts_count = len(active_alerts)
        for alt in active_alerts:
            alt.status = "RESOLVED"

        # 4. Count historical runs and events (THEY MUST NOT BE DELETED!)
        historical_runs = db.query(SimulationRun).count()
        historical_events = db.query(NetworkEvent).count()

        # 5. Insert audit event for baseline reset
        now = datetime.utcnow()
        reset_event = NetworkEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            timestamp=now,
            event_type="BASELINE_RESET",
            severity="INFO",
            message="Controlled baseline network reset executed: all nodes and links restored to default operational state.",
            affected_resource="NETWORK",
        )
        db.add(reset_event)

        db.commit()

        return BaselineResetResponse(
            status="success",
            message="Controlled baseline reset complete. Default network configuration restored; historical runs and telemetry preserved.",
            restored_nodes_count=restored_nodes_count,
            restored_links_count=restored_links_count,
            resolved_alerts_count=resolved_alerts_count,
            historical_runs_preserved=historical_runs,
            historical_events_preserved=historical_events + 1,
            timestamp=now,
        )


def get_reachability_matrix(
    db: Session,
    source_node_id: Optional[str] = "HQ-COMMAND-01",
) -> ReachabilityMatrixResponse:
    """Evaluate reachability matrix from source to all destinations across the network."""
    with network_state_lock:
        seed_database_idempotent(db)
        nodes_dict = {n.node_id: n for n in db.query(NetworkNode).all()}
        resolved_src = resolve_node_id(nodes_dict, source_node_id or "HQ-COMMAND-01") or "HQ-COMMAND-01"

        engine = build_routing_engine(db)
        destinations: Dict[str, Dict[str, Any]] = {}
        reachable_count = 0

        target_nodes = db.query(NetworkNode).all()
        for tn in target_nodes:
            if tn.node_id == resolved_src:
                destinations[tn.node_id] = {
                    "name": tn.name,
                    "node_type": tn.node_type,
                    "department": tn.department,
                    "reachable": tn.status != "offline",
                    "cost": 0.0,
                    "hops": 0,
                    "path": [tn.node_id],
                    "status": "SELF",
                }
                if tn.status != "offline":
                    reachable_count += 1
                continue

            route_res = engine.calculate_shortest_path(resolved_src, tn.node_id)
            is_reachable = route_res.reachable
            if is_reachable:
                reachable_count += 1

            destinations[tn.node_id] = {
                "name": tn.name,
                "node_type": tn.node_type,
                "department": tn.department,
                "reachable": is_reachable,
                "cost": route_res.total_cost if is_reachable else None,
                "hops": len(route_res.selected_path) - 1 if is_reachable else 0,
                "path": route_res.selected_path,
                "alternate_path_selected": route_res.alternate_path_selected,
                "status": "OPTIMAL" if is_reachable else "UNREACHABLE",
            }

        total_dest = len(target_nodes)
        pct = round((reachable_count / total_dest * 100.0), 1) if total_dest > 0 else 0.0

        return ReachabilityMatrixResponse(
            source_node_id=resolved_src,
            total_destinations=total_dest,
            reachable_destinations=reachable_count,
            reachability_percentage=pct,
            destinations=destinations,
        )


