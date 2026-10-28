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
    SchedulerComparisonItem,
    SchedulerComparisonResponse,
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


def calculate_bandwidth_allocation(
    policy: str,
    offered_loads: Dict[str, float],
    bottleneck_capacity: float,
    is_congested: bool,
    competing_traffic: bool = True,
) -> Dict[str, float]:
    """
    Deterministic bandwidth allocation across traffic classes based on scheduler policy.
    Supports Pure Strict Priority, Weighted Fair Queueing (WFQ), Round Robin, and SP-SS.
    """
    allocated: Dict[str, float] = {}
    if not is_congested:
        for c, l in offered_loads.items():
            allocated[c] = l
        return allocated

    norm_policy = (policy or "").lower().strip()

    if norm_policy in ("strict_priority", "sp", "strict"):
        # Pure Strict Priority: Critical gets first claim; Normal and Low starve under overload
        rem = bottleneck_capacity
        for c in ["CRITICAL", "HIGH", "NORMAL", "LOW"]:
            b = min(offered_loads.get(c, 0.0), rem)
            allocated[c] = round(b, 2)
            rem = max(0.0, rem - b)
        return allocated

    elif norm_policy in ("weighted_fair_queueing", "wfq", "wrr", "weighted"):
        # Weighted Fair Queueing / Proportional Bandwidth Sharing
        # Relative weights: Critical=50%, High=30%, Normal=15%, Low=5%
        weights = {"CRITICAL": 0.50, "HIGH": 0.30, "NORMAL": 0.15, "LOW": 0.05}
        active_classes = [c for c in ["CRITICAL", "HIGH", "NORMAL", "LOW"] if offered_loads.get(c, 0.0) > 0]
        if not active_classes:
            return {c: 0.0 for c in offered_loads}

        for c in offered_loads:
            allocated[c] = 0.0

        rem_cap = bottleneck_capacity
        unsatisfied = list(active_classes)

        for _ in range(len(active_classes)):
            if not unsatisfied or rem_cap <= 0.0:
                break
            curr_sum_w = sum(weights[c] for c in unsatisfied)
            new_unsatisfied = []
            for c in unsatisfied:
                share = (weights[c] / curr_sum_w) * rem_cap
                needed = offered_loads[c] - allocated[c]
                if needed <= share:
                    allocated[c] += needed
                    rem_cap -= needed
                else:
                    allocated[c] += share
                    rem_cap -= share
                    new_unsatisfied.append(c)
            unsatisfied = new_unsatisfied

        return {c: round(allocated.get(c, 0.0), 2) for c in offered_loads}

    elif norm_policy in ("round_robin", "rr", "fair_share"):
        # Round Robin: Equal bandwidth shares among all active competing classes
        active_classes = [c for c in ["CRITICAL", "HIGH", "NORMAL", "LOW"] if offered_loads.get(c, 0.0) > 0]
        for c in offered_loads:
            allocated[c] = 0.0
        rem_cap = bottleneck_capacity
        unsatisfied = list(active_classes)

        for _ in range(len(active_classes)):
            if not unsatisfied or rem_cap <= 0.0:
                break
            share = rem_cap / len(unsatisfied)
            new_unsatisfied = []
            for c in unsatisfied:
                needed = offered_loads[c] - allocated[c]
                if needed <= share:
                    allocated[c] += needed
                    rem_cap -= needed
                else:
                    allocated[c] += share
                    rem_cap -= share
                    new_unsatisfied.append(c)
            unsatisfied = new_unsatisfied

        return {c: round(allocated.get(c, 0.0), 2) for c in offered_loads}

    else:
        # Default: strict_priority_with_safeguards (SP-SS)
        starvation_safeguard_mbps = (
            round(0.08 * bottleneck_capacity, 2)
            if competing_traffic and is_congested and offered_loads.get("LOW", 0.0) > 0
            else 0.0
        )
        cap_for_high_priority = max(0.0, bottleneck_capacity - starvation_safeguard_mbps)

        b_crit = min(offered_loads["CRITICAL"], cap_for_high_priority)
        allocated["CRITICAL"] = round(b_crit, 2)
        rem_cap_1 = max(0.0, cap_for_high_priority - b_crit)

        b_high = min(offered_loads["HIGH"], rem_cap_1)
        allocated["HIGH"] = round(b_high, 2)
        rem_cap_2 = max(0.0, rem_cap_1 - b_high)

        b_norm = min(offered_loads["NORMAL"], rem_cap_2)
        allocated["NORMAL"] = round(b_norm, 2)
        rem_cap_3 = max(0.0, rem_cap_2 - b_norm)

        b_low_avail = rem_cap_3 + starvation_safeguard_mbps
        b_low = min(offered_loads["LOW"], b_low_avail)
        allocated["LOW"] = round(b_low, 2)

        return allocated


def compute_class_metrics(
    offered_loads: Dict[str, float],
    allocated_bandwidth: Dict[str, float],
    bottleneck_capacity: float,
    total_offered_load: float,
    is_congested: bool,
    link_utilization_pct: float,
    propagation_latency: float,
    trans_delay: float,
    target_class: str,
    target_packet_count: int,
) -> List[ClassQoSResult]:
    """Compute detailed per-class QoS metrics, queue delay, and delivery ratios."""
    results: List[ClassQoSResult] = []
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
        if c_code == target_class:
            c_packets_sent = target_packet_count
        else:
            if offered_loads.get(target_class, 0.0) > 0:
                scale = offered / offered_loads[target_class]
            else:
                scale = 1.0
            c_packets_sent = max(10, int(round(target_packet_count * scale)))

        c_packets_delivered = int(round(c_packets_sent * (delivery_ratio / 100.0)))
        c_packets_lost = max(0, c_packets_sent - c_packets_delivered)

        # Status text
        if delivery_ratio >= 99.5:
            c_status = "OPTIMAL" if queue_delay < 5.0 else "DELAY_MINIMAL"
        elif delivery_ratio >= 75.0:
            c_status = "CONGESTED_DEGRADED"
        elif delivery_ratio > 0.0:
            c_status = "RATE_LIMITED_DROPPING"
        else:
            c_status = "STARVED_100PCT_LOSS"

        results.append(
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

    return results


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

    # 3. Deterministic Scheduling
    allocated_bandwidth = calculate_bandwidth_allocation(
        policy=request.scheduler_policy,
        offered_loads=offered_loads,
        bottleneck_capacity=bottleneck_capacity,
        is_congested=is_congested,
        competing_traffic=request.competing_traffic,
    )

    # 4. Compute Metrics per Priority Class
    results_by_class = compute_class_metrics(
        offered_loads=offered_loads,
        allocated_bandwidth=allocated_bandwidth,
        bottleneck_capacity=bottleneck_capacity,
        total_offered_load=total_offered_load,
        is_congested=is_congested,
        link_utilization_pct=link_utilization_pct,
        propagation_latency=propagation_latency,
        trans_delay=trans_delay,
        target_class=canonical_target_class,
        target_packet_count=request.packet_count,
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


def compare_qos_schedulers(
    db: Session,
    request: Optional[QoSSimulationRequest] = None,
) -> SchedulerComparisonResponse:
    """
    Execute deterministic comparative evaluation across all 4 scheduling policies:
    1. Pure Strict Priority (SP) - demonstrates lower-class starvation under overload
    2. Strict Priority with Starvation Safeguard (SP-SS) - preserves 8% baseline emergency reservation
    3. Weighted Fair Queueing (WFQ) - proportional weights guarantee non-starvation service
    4. Round Robin (RR) - equal-share allocation without emergency prioritization
    """
    seed_database_idempotent(db)
    if request is None:
        request = QoSSimulationRequest(
            source_department="Emergency Control Center",
            destination_department="Hospital",
            traffic_class="CRITICAL",
            packet_count=100,
            offered_load_mbps=50.0,
            test_duration_sec=10.0,
            competing_traffic=True,
        )
    nodes_dict = {n.node_id: n for n in db.query(NetworkNode).all()}
    links_dict = {l.link_id: l for l in db.query(NetworkLink).all()}

    src_node_id = resolve_node_id(nodes_dict, request.source_department) or "HQ-COMMAND-01"
    dest_node_id = resolve_node_id(nodes_dict, request.destination_department) or "HOSPITAL-TRIAGE-03"
    canonical_target_class = normalize_class_code(request.traffic_class)

    engine = build_routing_engine(db)
    route_calc = engine.calculate_shortest_path(src_node_id, dest_node_id)

    bottleneck_capacity = 100.0
    bottleneck_link_id = "LINK-DIST-DEFAULT"
    propagation_latency = 2.5

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

    trans_delay = round(12000.0 / (bottleneck_capacity * 1000.0), 3)

    offered_loads: Dict[str, float] = {}
    for c_code, meta in QOS_CLASS_DEFINITIONS.items():
        if c_code == canonical_target_class:
            offered_loads[c_code] = round(float(request.offered_load_mbps), 2)
        elif request.competing_traffic:
            offered_loads[c_code] = meta["default_competing_mbps"]
        else:
            offered_loads[c_code] = 0.0

    total_offered = sum(offered_loads.values())
    is_congested = total_offered > bottleneck_capacity
    link_util = min(100.0, round((total_offered / bottleneck_capacity) * 100.0, 2))

    policies = [
        ("strict_priority", "Strict Priority (SP)", "High priority classes receive unconstrained preferential service; can starve Low/Normal under sustained critical overload."),
        ("strict_priority_with_safeguards", "Strict Priority + Safeguard (SP-SS)", "Strict priority with dedicated 8% bandwidth starvation safeguard reservation for background telemetry."),
        ("weighted_fair_queueing", "Weighted Fair Queueing (WFQ)", "Proportional bandwidth allocation (50% Critical, 30% High, 15% Normal, 5% Low); prevents starvation completely."),
        ("round_robin", "Round Robin (RR)", "Equal bandwidth turn among active traffic classes; fair share, but lacks emergency preemption for life-safety traffic."),
    ]

    sched_items: List[SchedulerComparisonItem] = []

    for pol_key, pol_name, desc in policies:
        alloc = calculate_bandwidth_allocation(
            policy=pol_key,
            offered_loads=offered_loads,
            bottleneck_capacity=bottleneck_capacity,
            is_congested=is_congested,
            competing_traffic=request.competing_traffic,
        )
        class_res = compute_class_metrics(
            offered_loads=offered_loads,
            allocated_bandwidth=alloc,
            bottleneck_capacity=bottleneck_capacity,
            total_offered_load=total_offered,
            is_congested=is_congested,
            link_utilization_pct=link_util,
            propagation_latency=propagation_latency,
            trans_delay=trans_delay,
            target_class=canonical_target_class,
            target_packet_count=request.packet_count,
        )

        res_dict = {r.traffic_class: r for r in class_res}
        crit_deliv = res_dict.get("CRITICAL", class_res[0]).delivery_ratio_pct
        norm_deliv = res_dict.get("NORMAL", class_res[0]).delivery_ratio_pct
        low_deliv = res_dict.get("LOW", class_res[0]).delivery_ratio_pct

        starved = any(r.allocated_mbps == 0.0 and r.offered_mbps > 0.0 for r in class_res)
        has_safeguard = "safeguard" in pol_key

        sched_items.append(
            SchedulerComparisonItem(
                policy_key=pol_key,
                policy_name=pol_name,
                description=desc,
                starvation_observed=starved,
                starvation_safeguard_active=has_safeguard,
                critical_delivery_pct=crit_deliv,
                normal_delivery_pct=norm_deliv,
                low_delivery_pct=low_deliv,
                results_by_class=class_res,
            )
        )

    insights = (
        "QoS SCHEDULER INSIGHTS: Under sustained critical congestion (>100% capacity), Pure Strict Priority guarantees 100% "
        "delivery for Ambulance & Hospital communication but starves administrative/background traffic to 0% delivery. "
        "Weighted Fair Queueing (WFQ) prevents starvation by guaranteeing class proportional minimums (50/30/15/5%). "
        "Round Robin divides capacity equally, but fails emergency dispatch requirements by degrading Critical traffic to the same rate as background data."
    )

    return SchedulerComparisonResponse(
        source_department=request.source_department,
        destination_department=request.destination_department,
        bottleneck_link_id=bottleneck_link_id,
        bottleneck_capacity_mbps=bottleneck_capacity,
        total_offered_load_mbps=round(total_offered, 2),
        is_congested=is_congested,
        schedulers=sched_items,
        engineering_insights=insights,
    )

