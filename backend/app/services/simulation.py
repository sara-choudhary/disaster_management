import heapq
import math
import uuid
from datetime import datetime
from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session

from app.models.node import NetworkNode, NodeStatus
from app.models.message import EmergencyMessage, MessagePriority, MessageStatus
from app.schemas.simulation import SimulationRunRequest, SimulationRunResponse, HopDetail


DEFAULT_NODES = [
    {
        "node_id": "HQ-COMMAND-01",
        "name": "Central Emergency Command",
        "node_type": "command_center",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 100.0,
        "pos_x": 100.0,
        "pos_y": 150.0,
    },
    {
        "node_id": "RELAY-NORTH-02",
        "name": "Northern Hill Mesh Relay",
        "node_type": "relay",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 85.0,
        "pos_x": 300.0,
        "pos_y": 80.0,
    },
    {
        "node_id": "HOSPITAL-TRIAGE-03",
        "name": "District Hospital Triage",
        "node_type": "hospital",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 92.0,
        "pos_x": 550.0,
        "pos_y": 120.0,
    },
    {
        "node_id": "RELAY-VALLEY-04",
        "name": "Valley Mobile Transceiver",
        "node_type": "relay",
        "status": NodeStatus.DEGRADED.value,
        "battery_level": 45.0,
        "pos_x": 320.0,
        "pos_y": 280.0,
    },
    {
        "node_id": "SHELTER-SOUTH-05",
        "name": "Civic Center Evacuation Shelter",
        "node_type": "shelter",
        "status": NodeStatus.ACTIVE.value,
        "battery_level": 78.0,
        "pos_x": 560.0,
        "pos_y": 320.0,
    },
]


def seed_default_nodes_if_empty(db: Session) -> List[NetworkNode]:
    """Ensures a baseline set of nodes exists in the SQLite database."""
    count = db.query(NetworkNode).count()
    if count == 0:
        created_nodes = []
        for item in DEFAULT_NODES:
            node = NetworkNode(**item)
            db.add(node)
            created_nodes.append(node)
        db.commit()
        for node in created_nodes:
            db.refresh(node)
        return created_nodes
    return db.query(NetworkNode).all()


class DeterministicNetworkRouter:
    """
    Deterministic graph router with priority-based link weighting.
    Priority alters link penalties:
      - CRITICAL_SOS: Minimal latency, prioritized broadcast path
      - HIGH_MEDICAL: Prefer highly stable nodes (battery > 50%)
      - NORMAL_LOGISTICS / LOW_ROUTINE: Normal cost routing
    """

    MAX_COMMUNICATION_RANGE = 350.0  # Euclidean distance threshold for direct link

    @classmethod
    def calculate_distance(cls, n1: NetworkNode, n2: NetworkNode) -> float:
        return math.hypot(n1.pos_x - n2.pos_x, n1.pos_y - n2.pos_y)

    @classmethod
    def compute_priority_weight(
        cls,
        from_node: NetworkNode,
        to_node: NetworkNode,
        priority: str,
    ) -> float:
        distance = cls.calculate_distance(from_node, to_node)
        
        # Base latency penalty proportional to distance (approx 1ms per 10 units)
        base_cost = distance / 10.0

        # Battery penalty: nodes with low battery increase weight
        battery_penalty = 1.0
        if to_node.battery_level < 20.0:
            battery_penalty = 3.0
        elif to_node.battery_level < 50.0:
            battery_penalty = 1.5

        # Degraded status penalty
        status_penalty = 2.0 if to_node.status == NodeStatus.DEGRADED.value else 1.0

        # Priority modifier
        if priority == MessagePriority.CRITICAL_SOS.value:
            # Critical messages bypass non-essential delays
            return base_cost * 0.8 * status_penalty
        elif priority == MessagePriority.HIGH_MEDICAL.value:
            return base_cost * battery_penalty * status_penalty
        else:
            return base_cost * battery_penalty * (status_penalty * 1.5)

    @classmethod
    def find_optimal_path(
        cls,
        nodes: Dict[str, NetworkNode],
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

                dist_between = cls.calculate_distance(current_node, neighbor_node)
                if dist_between > cls.MAX_COMMUNICATION_RANGE:
                    continue

                weight = cls.compute_priority_weight(current_node, neighbor_node, priority)
                candidate_dist = current_dist + weight

                if candidate_dist < distances[neighbor_id]:
                    distances[neighbor_id] = candidate_dist
                    previous[neighbor_id] = current_node_id
                    heapq.heappush(pq, (candidate_dist, neighbor_id))

        if distances[target_id] == float("inf"):
            return None, 0.0

        # Reconstruct path
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

    failed_set = list(set(request.simulate_node_failures or []))
    path, total_latency = DeterministicNetworkRouter.find_optimal_path(
        nodes=all_nodes,
        source_id=request.source_node_id,
        target_id=request.target_node_id,
        priority=request.priority,
        failed_node_ids=failed_set,
    )

    simulation_id = f"SIM-{uuid.uuid4().hex[:8].upper()}"
    msg_id = f"MSG-{uuid.uuid4().hex[:8].upper()}"

    if not path or len(path) < 1:
        # Save failed message record
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
        hop_latency = round(
            DeterministicNetworkRouter.compute_priority_weight(u_node, v_node, request.priority), 2
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
    )
