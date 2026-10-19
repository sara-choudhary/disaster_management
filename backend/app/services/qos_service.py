"""
Quality of Service (QoS) and Traffic-Priority Simulation Engine.

NOTE:
- Routing (OSPF-inspired SPF) selects and establishes topological paths between source and destination endpoints.
- The QoS model controls packet queueing, link bandwidth allocation, and transmission scheduling across bottleneck links.
- Implements Strict Priority Queuing with Minimum Bandwidth Starvation Safeguards (SP-SS) and Weighted Schedulers.
- All results are deterministic simulated estimates.
"""

import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from sqlalchemy.orm import Session

from app.models.node import NetworkNode
from app.models.link import NetworkLink
from app.models.department import Department
from app.models.alert import Alert
from app.models.event import NetworkEvent
from app.schemas.traffic_class import (
    QoSSimulationRequest,
    QoSSimulationResponse,
    ClassQoSResult,
)
from app.services.seed_data import seed_database_idempotent
from app.services.network_service import resolve_node_id, build_routing_engine


# Canonical QoS Classes Definition
QOS_CLASS_DEFINITIONS = {
    "CRITICAL": {
        "name": "Critical: Ambulance Dispatch & Hospital Coordination",
        "priority": 1,
        "default_competing_mbps": 15.0,
        "min_reserve_pct": 40.0,
        "latency_budget_ms": 20.0,
        "uncongested_delay_ms": 0.2,
        "congested_base_delay_ms": 0.8,
    },
    "HIGH": {
        "name": "High: Police & Fire Communication",
        "priority": 2,
        "default_competing_mbps": 25.0,
        "min_reserve_pct": 30.0,
        "latency_budget_ms": 45.0,
        "uncongested_delay_ms": 0.4,
        "congested_base_delay_ms": 2.5,
    },
    "NORMAL": {
        "name": "Normal: Ordinary Departmental Communication",
        "priority": 3,
        "default_competing_mbps": 35.0,
        "min_reserve_pct": 20.0,
        "latency_budget_ms": 100.0,
        "uncongested_delay_ms": 0.8,
        "congested_base_delay_ms": 15.0,
    },
    "LOW": {
        "name": "Low: Administrative or Background Traffic",
        "priority": 4,
        "default_competing_mbps": 35.0,
        "min_reserve_pct": 10.0,  # Starvation safeguard
        "latency_budget_ms": 250.0,
        "uncongested_delay_ms": 1.2,
        "congested_base_delay_ms": 50.0,
    },
}

CLASS_ALIASES = {
    "critical": "CRITICAL",
    "critical_sos": "CRITICAL",
    "sos": "CRITICAL",
    "ambulance": "CRITICAL",
    "hospital": "CRITICAL",
    "high": "HIGH",
    "high_medical": "HIGH",
    "police": "HIGH",
    "fire": "HIGH",
    "normal": "NORMAL",
    "normal_logistics": "NORMAL",
    "logistics": "NORMAL",
    "routine": "NORMAL",
    "low": "LOW",
    "low_routine": "LOW",
    "admin": "LOW",
    "background": "LOW",
}


def normalize_class_code(code: str) -> str:
    """Normalize input string to canonical class code."""
    cleaned = (code or "CRITICAL").strip().lower()
    return CLASS_ALIASES.get(cleaned, "CRITICAL")


def simulate_traffic_qos(
    db: Session,
    request: QoSSimulationRequest,
) -> QoSSimulationResponse:
    """
    Execute a deterministic QoS and traffic-priority simulation over the network topology.
    Evaluates bottleneck bandwidth, competing loads, and SP-SS queue scheduling.
    """
    seed_database_idempotent(db)

    nodes_dict = {n.node_id: n for n in db.query(NetworkNode).all()}
    links_dict = {l.link_id: l for l in db.query(NetworkLink).all()}

    # Resolve source and destination
    src_node_id = resolve_node_id(nodes_dict, request.source_department) or "HQ-COMMAND-01"
    dest_node_id = resolve_node_id(nodes_dict, request.destination_department) or "HOSPITAL-TRIAGE-03"

    canonical_target_class = normalize_class_code(request.traffic_class)

    # 1. Path Calculation using OSPF Routing Engine
    engine = build_routing_engine(db)
    route_calc = engine.calculate_shortest_path(src_node_id, dest_node_id)

    path = route_calc.selected_path if route_calc.reachable else [src_node_id, dest_node_id]

    # Find bottleneck link capacity & cumulative propagation latency
    bottleneck_capacity = 100.0  # default Mbps
    bottleneck_link_id = "LINK-DIST-DEFAULT"
    propagation_latency = 0.0

    if route_calc.reachable and route_calc.hop_list:
        min_bw = float("inf")
        for hop in route_calc.hop_list:
            propagation_latency += hop.latency_ms
            if hop.link_id and hop.link_id in links_dict:
                l_obj = links_dict[hop.link_id]
                if l_obj.bandwidth < min_bw:
                    min_bw = l_obj.bandwidth
                    bottleneck_link_id = l_obj.link_id
                    bottleneck_capacity = l_obj.bandwidth
        if min_bw < float("inf"):
            bottleneck_capacity = min_bw
    else:
        # Default nominal fallback propagation latency
        propagation_latency = 2.5

    # Transmission serialization delay (approx. 1500 bytes per packet on bottleneck)
    # 1500 bytes = 12000 bits. On 100 Mbps, serialization is 0.12 ms.
    trans_delay = round(12000.0 / (bottleneck_capacity * 1000.0), 3)

    # 2. Offered Load by Class
    offered_loads: Dict[str, float] = {}
    for c_code, meta in QOS_CLASS_DEFINITIONS.items():
        if c_code == canonical_target_class:
            offered_loads[c_code] = round(float(request.offered_load_mbps), 2)
        elif request.competing_traffic:
            offered_loads[c_code] = meta["default_competing_mbps"]
        else:
            offered_loads[c_code] = 0.0

    total_offered_load = sum(offered_loads.values())
    is_congested = total_offered_load > bottleneck_capacity
    link_utilization_pct = min(100.0, round((total_offered_load / bottleneck_capacity) * 100.0, 2))

    # 3. Deterministic Scheduling: Strict Priority with Starvation Safeguard (SP-SS)
    # Low-priority traffic receives an 8% starvation safeguard reservation unless
    # capacity is strictly exhausted by Critical alone.
    allocated_bandwidth: Dict[str, float] = {}
    starvation_safeguard_mbps = (
        round(0.08 * bottleneck_capacity, 2)
        if request.competing_traffic and is_congested and offered_loads["LOW"] > 0
        else 0.0
    )

    if not is_congested:
        # Uncongested: All classes get 100% of offered traffic
        for c_code, load in offered_loads.items():
            allocated_bandwidth[c_code] = load
    else:
        # Congested: Strict Priority with Starvation Safeguard
        cap_for_high_priority = max(0.0, bottleneck_capacity - starvation_safeguard_mbps)

        # 1. Critical (Priority 1)
        b_crit = min(offered_loads["CRITICAL"], cap_for_high_priority)
        allocated_bandwidth["CRITICAL"] = round(b_crit, 2)
        rem_cap_1 = max(0.0, cap_for_high_priority - b_crit)

        # 2. High (Priority 2)
        b_high = min(offered_loads["HIGH"], rem_cap_1)
        allocated_bandwidth["HIGH"] = round(b_high, 2)
        rem_cap_2 = max(0.0, rem_cap_1 - b_high)

        # 3. Normal (Priority 3)
        b_norm = min(offered_loads["NORMAL"], rem_cap_2)
        allocated_bandwidth["NORMAL"] = round(b_norm, 2)
        rem_cap_3 = max(0.0, rem_cap_2 - b_norm)

        # 4. Low (Priority 4) gets remainder + safeguard
        b_low_avail = rem_cap_3 + starvation_safeguard_mbps
        b_low = min(offered_loads["LOW"], b_low_avail)
        allocated_bandwidth["LOW"] = round(b_low, 2)

    # 4. Compute Metrics per Priority Class
    results_by_class: List[ClassQoSResult] = []
    congestion_ratio = (
        max(0.0, (total_offered_load - bottleneck_capacity) / bottleneck_capacity)
        if is_congested
        else 0.0
    )

    for c_code in ["CRITICAL", "HIGH", "NORMAL", "LOW"]:
        meta = QOS_CLASS_DEFINITIONS[c_code]
        offered = offered_loads[c_code]
        allocated = allocated_bandwidth.get(c_code, 0.0)

        # Delivery Ratio
        if offered <= 0.0:
            delivery_ratio = 100.0
        else:
            delivery_ratio = min(100.0, round((allocated / offered) * 100.0, 2))

        # Queue Delay modeling
        if not is_congested:
            queue_delay = round(meta["uncongested_delay_ms"] * max(0.2, (link_utilization_pct / 100.0)), 2)
        else:
            if c_code == "CRITICAL":
                queue_delay = round(meta["congested_base_delay_ms"] + 0.5 * congestion_ratio, 2)
            elif c_code == "HIGH":
                queue_delay = round(meta["congested_base_delay_ms"] + 3.0 * congestion_ratio, 2)
            elif c_code == "NORMAL":
                queue_delay = round(meta["congested_base_delay_ms"] + 25.0 * congestion_ratio, 2)
            else:  # LOW
                queue_delay = round(meta["congested_base_delay_ms"] + 70.0 * congestion_ratio, 2)

        est_latency = round(propagation_latency + trans_delay + queue_delay, 2)

        # Packets count
        if c_code == canonical_target_class:
            c_packets_sent = request.packet_count
        else:
            if offered_loads[canonical_target_class] > 0:
                scale = offered / offered_loads[canonical_target_class]
            else:
                scale = 1.0
            c_packets_sent = max(10, int(round(request.packet_count * scale)))

        c_packets_delivered = int(round(c_packets_sent * (delivery_ratio / 100.0)))
        c_packets_lost = max(0, c_packets_sent - c_packets_delivered)

        # Status text
        if delivery_ratio >= 99.5:
            c_status = "OPTIMAL" if queue_delay < 5.0 else "DELAY_MINIMAL"
        elif delivery_ratio >= 75.0:
            c_status = "CONGESTED_DEGRADED"
        else:
            c_status = "RATE_LIMITED_DROPPING"

        results_by_class.append(
            ClassQoSResult(
                traffic_class=c_code,
                class_name=meta["name"],
                priority=meta["priority"],
                offered_mbps=offered,
                allocated_mbps=allocated,
                packets_sent=c_packets_sent,
                packets_delivered=c_packets_delivered,
                packets_lost=c_packets_lost,
                delivery_ratio_pct=delivery_ratio,
                estimated_latency_ms=est_latency,
                queue_delay_ms=queue_delay,
                status=c_status,
            )
        )

    # 5. Extract Results for the Target Selected Class
    target_result = next(
        (r for r in results_by_class if r.traffic_class == canonical_target_class),
        results_by_class[0],
    )

    simulation_id = f"QOS-{uuid.uuid4().hex[:8].upper()}"

    # Log congestion alert if bottleneck link is over capacity
    if is_congested or link_utilization_pct >= 80.0:
        cong_alert = Alert(
            alert_id=f"ALT-CONG-{uuid.uuid4().hex[:8].upper()}",
            severity="CRITICAL" if link_utilization_pct >= 100.0 else "WARNING",
            category="CONGESTION",
            title=f"Bottleneck Link Congestion: {bottleneck_link_id}",
            description=(
                f"Traffic load ({round(total_offered_load, 1)} Mbps) exceeded capacity ({bottleneck_capacity} Mbps) "
                f"on bottleneck link {bottleneck_link_id} ({round(link_utilization_pct, 1)}% utilization). "
                f"Strict priority scheduling active."
            ),
            status="ACTIVE",
            affected_resource=bottleneck_link_id,
            related_run=simulation_id,
            timestamp=datetime.utcnow(),
        )
        db.add(cong_alert)

        cong_event = NetworkEvent(
            event_id=f"EVT-CONG-{uuid.uuid4().hex[:8].upper()}",
            timestamp=datetime.utcnow(),
            event_type="TRAFFIC_CONGESTION",
            severity="CRITICAL" if link_utilization_pct >= 100.0 else "WARNING",
            message=f"Traffic congestion detected on {bottleneck_link_id} ({round(link_utilization_pct, 1)}% utilization).",
            affected_resource=bottleneck_link_id,
            related_run=simulation_id,
        )
        db.add(cong_event)
        db.commit()

    sim_notice = (
        "SIMULATED ESTIMATE: All queuing, transmission delay, and packet delivery ratios "
        "are calculated by the deterministic QoS queuing and transmission model based on link capacity "
        "constraints, offered loads, and strict priority starvation-safeguard scheduling. "
        "These metrics reflect modeled packet transit in emergency operations."
    )

    qos_explanation = (
        "ROUTING VS. QOS MODEL: OSPF-inspired routing calculates and selects the shortest topological paths "
        "between network nodes based on link costs and reachability. The Quality of Service (QoS) model "
        "controls packet queueing, scheduling policies, and bandwidth prioritization across bottleneck links "
        "once paths are established, ensuring life-safety critical telemetry preempts non-critical traffic "
        "during network congestion."
    )

    return QoSSimulationResponse(
        simulation_id=simulation_id,
        timestamp=datetime.utcnow(),
        source_department=request.source_department,
        destination_department=request.destination_department,
        selected_class=canonical_target_class,
        path=path,
        bottleneck_link_id=bottleneck_link_id,
        bottleneck_capacity_mbps=bottleneck_capacity,
        total_offered_load_mbps=round(total_offered_load, 2),
        link_utilization_pct=link_utilization_pct,
        is_congested=is_congested,
        scheduler_policy="Strict Priority with Starvation Safeguard (SP-SS)",
        test_duration_sec=request.test_duration_sec,
        packets_sent=target_result.packets_sent,
        packets_delivered=target_result.packets_delivered,
        packets_lost=target_result.packets_lost,
        delivery_ratio_pct=target_result.delivery_ratio_pct,
        estimated_latency_ms=target_result.estimated_latency_ms,
        queue_delay_ms=target_result.queue_delay_ms,
        results_by_class=results_by_class,
        simulated_estimate_notice=sim_notice,
        qos_vs_routing_explanation=qos_explanation,
    )
