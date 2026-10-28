import heapq
import math
import uuid
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session

from app.models.node import NetworkNode, NodeStatus
from app.models.link import NetworkLink
from app.models.message import EmergencyMessage, MessagePriority, MessageStatus
from app.models.simulation import SimulationRun
from app.models.event import NetworkEvent
from app.schemas.simulation import SimulationRunRequest, SimulationRunResponse, HopDetail
from app.services.seed_data import seed_database_idempotent


def seed_default_nodes_if_empty(db: Session) -> List[NetworkNode]:
    """Ensures baseline data is idempotently seeded in SQLite."""
    seed_database_idempotent(db)
    return db.query(NetworkNode).all()


class DeterministicNetworkRouter:
    """
    Deterministic graph router with priority-based link weighting.
    Priority alters link penalties:
      - CRITICAL_SOS: Minimal latency, prioritized broadcast path
      - HIGH_MEDICAL: Prefer highly stable nodes (battery > 50%)
      - NORMAL_LOGISTICS / LOW_ROUTINE: Normal cost routing
    """

    MAX_COMMUNICATION_RANGE = 350.0

    @classmethod
    def calculate_distance(cls, n1: NetworkNode, n2: NetworkNode) -> float:
        return math.hypot(n1.pos_x - n2.pos_x, n1.pos_y - n2.pos_y)

    @classmethod
    def compute_priority_weight(
        cls,
        from_node: NetworkNode,
        to_node: NetworkNode,
        priority: str,
        db_link: Optional[NetworkLink] = None,
    ) -> float:
        distance = cls.calculate_distance(from_node, to_node)
        base_cost = distance / 10.0

        if db_link is not None:
            base_cost = (db_link.latency / 2.0) * db_link.link_cost

        battery_penalty = 1.0
        if to_node.battery_level < 20.0:
            battery_penalty = 3.0
        elif to_node.battery_level < 50.0:
            battery_penalty = 1.5

        status_penalty = 2.0 if to_node.status == NodeStatus.DEGRADED.value else 1.0
        if db_link and db_link.operational_state == "DEGRADED":
            status_penalty *= 1.8

        if priority == MessagePriority.CRITICAL_SOS.value:
            return base_cost * 0.8 * status_penalty
        elif priority == MessagePriority.HIGH_MEDICAL.value:
            return base_cost * battery_penalty * status_penalty
        else:
            return base_cost * battery_penalty * (status_penalty * 1.5)

    @classmethod
    def find_optimal_path(
        cls,
        nodes: Dict[str, NetworkNode],
        links: Dict[Tuple[str, str], NetworkLink],
        source_id: str,
        target_id: str,
        priority: str,
        failed_node_ids: List[str],
    ) -> Tuple[Optional[List[str]], float]:
        """Dijkstra algorithm yielding deterministic shortest weighted route."""
        if source_id not in nodes or target_id not in nodes:
            return None, 0.0

        if source_id in failed_node_ids or target_id in failed_node_ids:
            return None, 0.0

        distances: Dict[str, float] = {nid: float("inf") for nid in nodes}
        previous: Dict[str, Optional[str]] = {nid: None for nid in nodes}
        distances[source_id] = 0.0

        pq: List[Tuple[float, str]] = [(0.0, source_id)]

        while pq:
            current_dist, current_node_id = heapq.heappop(pq)

            if current_dist > distances[current_node_id]:
                continue

            if current_node_id == target_id:
                break

            current_node = nodes[current_node_id]

            for neighbor_id, neighbor_node in nodes.items():
                if neighbor_id == current_node_id or neighbor_id in failed_node_ids:
                    continue
                if neighbor_node.status == NodeStatus.OFFLINE.value:
                    continue

                # Check if database link exists or if within communication range
                db_link = links.get((current_node_id, neighbor_id)) or links.get((neighbor_id, current_node_id))
                if db_link and db_link.operational_state == "DOWN":
                    continue

                dist_between = cls.calculate_distance(current_node, neighbor_node)
                if db_link is None and dist_between > cls.MAX_COMMUNICATION_RANGE:
                    continue

                weight = cls.compute_priority_weight(current_node, neighbor_node, priority, db_link)
                candidate_dist = current_dist + weight

                if candidate_dist < distances[neighbor_id]:
                    distances[neighbor_id] = candidate_dist
                    previous[neighbor_id] = current_node_id
                    heapq.heappush(pq, (candidate_dist, neighbor_id))

        if distances[target_id] == float("inf"):
            return None, 0.0

        path: List[str] = []
        curr: Optional[str] = target_id
        while curr is not None:
            path.append(curr)
            curr = previous[curr]
        path.reverse()

        return path, round(distances[target_id], 2)


def run_deterministic_simulation(
    db: Session,
    request: SimulationRunRequest,
) -> SimulationRunResponse:
    seed_default_nodes_if_empty(db)
    all_nodes = {node.node_id: node for node in db.query(NetworkNode).all()}
    all_links = {
        (link.source_node_id, link.destination_node_id): link
        for link in db.query(NetworkLink).all()
    }

    failed_set = list(set(request.simulate_node_failures or []))
    simulation_id = f"SIM-{uuid.uuid4().hex[:8].upper()}"
    msg_id = f"MSG-{uuid.uuid4().hex[:8].upper()}"

    start_time = datetime.utcnow()

    path, total_latency = DeterministicNetworkRouter.find_optimal_path(
        nodes=all_nodes,
        links=all_links,
        source_id=request.source_node_id,
        target_id=request.target_node_id,
        priority=request.priority,
        failed_node_ids=failed_set,
    )

    end_time = datetime.utcnow()
    duration_sec = round((end_time - start_time).total_seconds(), 4)

    initial_snapshot = {
        "nodes_count": len(all_nodes),
        "failed_nodes": failed_set,
        "priority": request.priority,
    }

    if not path or len(path) < 1:
        # Save dropped message record
        msg = EmergencyMessage(
            message_id=msg_id,
            sender_id=request.source_node_id,
            recipient_id=request.target_node_id,
            priority=request.priority,
            status=MessageStatus.DROPPED.value,
            content=request.message_content,
            hop_count=0,
            route_taken="",
        )
        db.add(msg)

        # Log simulation run record
        sim_run = SimulationRun(
            run_id=simulation_id,
            scenario_id=None,
            start_time=start_time,
            end_time=end_time,
            initial_state=initial_snapshot,
            final_state={"delivered": False, "hops": 0},
            result="FAILED",
            recovery_duration=duration_sec,
            packet_statistics={"total": 1, "delivered": 0, "dropped": 1},
        )
        db.add(sim_run)

        # Log network event
        evt = NetworkEvent(
            event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
            timestamp=datetime.utcnow(),
            event_type="PACKET_DROPPED",
            severity="CRITICAL",
            message=f"Packet {msg_id} dropped: no viable route between {request.source_node_id} and {request.target_node_id}.",
            affected_resource=request.target_node_id,
            related_run=simulation_id,
        )
        db.add(evt)
        db.commit()

        return SimulationRunResponse(
            simulation_id=simulation_id,
            success=False,
            priority=request.priority,
            source_node_id=request.source_node_id,
            target_node_id=request.target_node_id,
            path=[],
            total_hops=0,
            total_latency_ms=0.0,
            delivery_status=MessageStatus.DROPPED.value,
            details=[],
            message_id=msg_id,
        )

    # Build hop-by-hop breakdown
    details: List[HopDetail] = []
    for step in range(len(path) - 1):
        u_id = path[step]
        v_id = path[step + 1]
        u_node = all_nodes[u_id]
        v_node = all_nodes[v_id]
        db_link = all_links.get((u_id, v_id)) or all_links.get((v_id, u_id))
        hop_latency = round(
            DeterministicNetworkRouter.compute_priority_weight(
                u_node, v_node, request.priority, db_link
            ),
            2,
        )
        details.append(
            HopDetail(
                step=step + 1,
                from_node=u_id,
                to_node=v_id,
                latency_ms=hop_latency,
                status="FORWARDED",
                remaining_battery=max(0.0, round(v_node.battery_level - 0.2, 1)),
            )
        )

    route_str = " -> ".join(path)

    # Check if primary route was disrupted by failures and required retransmission over an alternate route
    baseline_path, _ = DeterministicNetworkRouter.find_optimal_path(
        nodes=all_nodes,
        links=all_links,
        source_id=request.source_node_id,
        target_id=request.target_node_id,
        priority=request.priority,
        failed_node_ids=[],
    )

    alternate_selected = False
    retransmissions = 0
    attempts = 1
    retry_log: List[str] = []

    if baseline_path and failed_set and any(n in failed_set for n in baseline_path):
        alternate_selected = True
        retransmissions = 1
        attempts = 2
        retry_log = [
            f"Initial transmission attempted via primary route ({' -> '.join(baseline_path)}).",
            f"Primary link severed by failed node(s): {', '.join(failed_set)}.",
            "Hardware BFD detected failure (10.0ms) -> Packet buffered during failure.",
            f"Dijkstra SPF calculated alternate failover route ({route_str}).",
            "Packet retransmitted (resent) and successfully delivered to destination (Attempt #2).",
        ]

    msg = EmergencyMessage(
        message_id=msg_id,
        sender_id=request.source_node_id,
        recipient_id=request.target_node_id,
        priority=request.priority,
        status=MessageStatus.DELIVERED.value,
        content=request.message_content,
        hop_count=len(path) - 1,
        route_taken=route_str,
        delivered_at=datetime.utcnow(),
    )
    db.add(msg)

    # Log simulation run record
    sim_run = SimulationRun(
        run_id=simulation_id,
        scenario_id=None,
        start_time=start_time,
        end_time=end_time,
        initial_state=initial_snapshot,
        final_state={"delivered": True, "path": path, "latency_ms": total_latency, "alternate_path_selected": alternate_selected},
        result="SUCCESS",
        recovery_duration=duration_sec,
        packet_statistics={
            "total": 1,
            "delivered": 1,
            "dropped": 0,
            "retransmissions": retransmissions,
            "avg_latency_ms": total_latency,
        },
    )
    db.add(sim_run)

    # Log network event
    evt = NetworkEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
        timestamp=datetime.utcnow(),
        event_type="PACKET_DELIVERED",
        severity="INFO",
        message=f"Packet {msg_id} ({request.priority}) delivered via {len(path) - 1} hops ({route_str}) after {retransmissions} retransmissions.",
        affected_resource=request.target_node_id,
        related_run=simulation_id,
    )
    db.add(evt)
    db.commit()

    return SimulationRunResponse(
        simulation_id=simulation_id,
        success=True,
        priority=request.priority,
        source_node_id=request.source_node_id,
        target_node_id=request.target_node_id,
        path=path,
        total_hops=len(path) - 1,
        total_latency_ms=total_latency,
        delivery_status=MessageStatus.DELIVERED.value,
        details=details,
        message_id=msg_id,
        transmission_attempts=attempts,
        retransmissions=retransmissions,
        alternate_route_selected=alternate_selected,
        retry_log=retry_log if retry_log else None,
    )
