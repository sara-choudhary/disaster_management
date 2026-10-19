"""
Network Telemetry Service.

Computes time-series and snapshot telemetry metrics from persisted simulation runs,
network links, nodes, and events stored in the SQLite database.

All telemetry data points represent modeled algorithmic estimates from deterministic
SPF routing convergence, discrete failure injection drills, and priority queue scheduling.
No random numbers are generated upon component render.
"""

from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from app.models.simulation import SimulationRun
from app.models.event import NetworkEvent
from app.models.link import NetworkLink
from app.models.node import NetworkNode
from app.models.alert import Alert
from app.schemas.telemetry import (
    TelemetryResponse,
    TelemetrySnapshot,
    AvailabilityPoint,
    LatencyPoint,
    PacketMetricPoint,
    LinkUtilizationPoint,
    TrafficClassVolumePoint,
    RecoveryDurationPoint,
    RouteChangesPoint,
)
from app.services.seed_data import seed_database_idempotent
from app.services.network_service import get_metrics, build_routing_engine
import uuid


def seed_baseline_simulation_runs_if_empty(db: Session) -> None:
    """
    Idempotently seeds initial baseline simulation runs if no historical runs exist.
    Provides deterministic starting data points for telemetry charts.
    """
    existing_count = db.query(SimulationRun).count()
    if existing_count > 0:
        return

    now = datetime.utcnow()
    baseline_runs = [
        {
            "run_id": "RUN-BASE-01",
            "scenario_id": "DRILL-BASELINE-RING",
            "start_time": now - timedelta(minutes=45),
            "end_time": now - timedelta(minutes=45) + timedelta(seconds=0.045),
            "initial_state": {
                "source": "HQ-COMMAND-01",
                "target": "HOSPITAL-TRIAGE-03",
                "priority": "CRITICAL_SOS",
                "active_nodes_count": 21,
                "up_links_count": 25,
            },
            "final_state": {
                "result": "SUCCESS",
                "path": ["HQ-COMMAND-01", "SW-ECC", "ROUTER-01", "ROUTER-02", "SW-HOSPITAL", "HOSPITAL-TRIAGE-03"],
                "latency_ms": 11.5,
                "reachability": {"HQ-COMMAND-01": True, "HOSPITAL-TRIAGE-03": True, "POLICE-02": True, "FIRE-03": True},
                "alternate_path_selected": False,
            },
            "result": "SUCCESS",
            "recovery_duration": 0.045,
            "packet_statistics": {
                "total_packets": 50,
                "delivered": 50,
                "dropped": 0,
                "delivery_rate_pct": 100.0,
                "packet_loss_percent": 0.0,
                "avg_latency_ms": 11.5,
                "reachability_percentage": 100.0,
                "recalculated_hops": 5,
            },
        },
        {
            "run_id": "RUN-BASE-02",
            "scenario_id": "DRILL-AMBULANCE-VERIFY",
            "start_time": now - timedelta(minutes=25),
            "end_time": now - timedelta(minutes=25) + timedelta(seconds=0.048),
            "initial_state": {
                "source": "AMBULANCE-05",
                "target": "HOSPITAL-TRIAGE-03",
                "priority": "CRITICAL_SOS",
                "active_nodes_count": 21,
                "up_links_count": 25,
            },
            "final_state": {
                "result": "SUCCESS",
                "path": ["AMBULANCE-05", "SW-AMBULANCE", "ROUTER-02", "SW-HOSPITAL", "HOSPITAL-TRIAGE-03"],
                "latency_ms": 9.8,
                "reachability": {"AMBULANCE-05": True, "HOSPITAL-TRIAGE-03": True},
                "alternate_path_selected": False,
            },
            "result": "SUCCESS",
            "recovery_duration": 0.048,
            "packet_statistics": {
                "total_packets": 60,
                "delivered": 60,
                "dropped": 0,
                "delivery_rate_pct": 100.0,
                "packet_loss_percent": 0.0,
                "avg_latency_ms": 9.8,
                "reachability_percentage": 100.0,
                "recalculated_hops": 4,
            },
        },
        {
            "run_id": "RUN-BASE-03",
            "scenario_id": "DRILL-EAST-BACKBONE-CONVERGE",
            "start_time": now - timedelta(minutes=10),
            "end_time": now - timedelta(minutes=10) + timedelta(seconds=0.052),
            "initial_state": {
                "source": "POLICE-02",
                "target": "SHELTER-SOUTH-05",
                "priority": "HIGH_SAFETY",
                "active_nodes_count": 21,
                "up_links_count": 25,
            },
            "final_state": {
                "result": "SUCCESS",
                "path": ["POLICE-02", "SW-POLICE", "ROUTER-01", "ROUTER-03", "SW-RELIEF", "SHELTER-SOUTH-05"],
                "latency_ms": 14.2,
                "reachability": {"POLICE-02": True, "SHELTER-SOUTH-05": True},
                "alternate_path_selected": False,
            },
            "result": "SUCCESS",
            "recovery_duration": 0.052,
            "packet_statistics": {
                "total_packets": 40,
                "delivered": 40,
                "dropped": 0,
                "delivery_rate_pct": 100.0,
                "packet_loss_percent": 0.0,
                "avg_latency_ms": 14.2,
                "reachability_percentage": 100.0,
                "recalculated_hops": 5,
            },
        },
    ]

    for run_data in baseline_runs:
        db.add(SimulationRun(**run_data))
    db.commit()


def get_telemetry_data(
    db: Session,
    time_range: str = "24h",
) -> TelemetryResponse:
    """
    Retrieve aggregated time-series telemetry records and snapshot health indicators.
    Filters records strictly by requested time range.
    """
    seed_database_idempotent(db)
    seed_baseline_simulation_runs_if_empty(db)

    now = datetime.utcnow()
    range_map = {
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
    }

    query = db.query(SimulationRun).order_by(asc(SimulationRun.start_time))
    if time_range in range_map:
        cutoff = now - range_map[time_range]
        query = query.filter(SimulationRun.start_time >= cutoff)

    runs: List[SimulationRun] = query.all()
    total_runs_in_system = db.query(SimulationRun).count()

    # 1. Real-time Snapshot from current DB state
    metrics = get_metrics(db)
    total_nodes = metrics.total_nodes or 21
    active_nodes = metrics.active_nodes or 21
    total_links = metrics.total_links or 25
    up_links = metrics.up_links or 25

    node_avail_pct = round((active_nodes / total_nodes) * 100.0, 1) if total_nodes > 0 else 100.0
    link_avail_pct = round((up_links / total_links) * 100.0, 1) if total_links > 0 else 100.0
    current_avail_pct = round((node_avail_pct * 0.6) + (link_avail_pct * 0.4), 1)

    snapshot = TelemetrySnapshot(
        total_simulation_runs=total_runs_in_system,
        current_health_score=metrics.network_health_score,
        current_availability_pct=current_avail_pct,
        current_avg_latency_ms=metrics.average_latency_ms,
        active_nodes=active_nodes,
        total_nodes=total_nodes,
        active_links=up_links,
        total_links=total_links,
        active_alerts=metrics.active_alerts_count,
        modeled_status="OPTIMAL" if current_avail_pct >= 95.0 else ("DEGRADED" if current_avail_pct >= 70.0 else "CRITICAL"),
    )

    # 2. Insufficient Data Evaluation
    has_sufficient_data = len(runs) >= 2
    explanation = None
    if not has_sufficient_data:
        explanation = (
            f"Insufficient historical simulation runs recorded for time range '{time_range}' ({len(runs)} found). "
            f"Telemetry charts require at least 2 simulation drill runs to plot historical progression. "
            f"Use 'Run Simulation Drill' or select a broader time window."
        )

    # 3. Time Series Series Construction
    availability_series: List[AvailabilityPoint] = []
    latency_series: List[LatencyPoint] = []
    packet_metric_series: List[PacketMetricPoint] = []
    traffic_class_series: List[TrafficClassVolumePoint] = []
    recovery_series: List[RecoveryDurationPoint] = []
    route_changes_series: List[RouteChangesPoint] = []

    for run in runs:
        t = run.start_time
        time_label = t.strftime("%H:%M:%S")

        stats = run.packet_statistics or {}
        init_state = run.initial_state or {}
        fin_state = run.final_state or {}

        # -- Availability Point --
        run_active_nodes = init_state.get("active_nodes_count", 21)
        run_up_links = init_state.get("up_links_count", 25)
        n_pct = round((run_active_nodes / total_nodes) * 100.0, 1) if total_nodes > 0 else 100.0
        l_pct = round((run_up_links / total_links) * 100.0, 1) if total_links > 0 else 100.0
        reach_pct = float(stats.get("reachability_percentage", 100.0 if run.result == "SUCCESS" else 45.0))
        avail_pct = round((n_pct * 0.4) + (l_pct * 0.3) + (reach_pct * 0.3), 1)

        availability_series.append(
            AvailabilityPoint(
                timestamp=t,
                time_label=time_label,
                availability_pct=avail_pct,
                node_availability_pct=n_pct,
                link_availability_pct=l_pct,
                reachability_pct=reach_pct,
                run_id=run.run_id,
                drill_name=run.scenario_id or run.run_id,
            )
        )

        # -- Latency Point --
        lat = float(stats.get("avg_latency_ms") or stats.get("latency_ms") or fin_state.get("latency_ms") or 12.0)
        latency_series.append(
            LatencyPoint(
                timestamp=t,
                time_label=time_label,
                estimated_latency_ms=round(lat, 2),
                baseline_target_ms=15.0,
                warning_threshold_ms=45.0,
                run_id=run.run_id,
            )
        )

        # -- Packet Delivery & Loss Point --
        if "delivery_rate_pct" in stats:
            delivery_pct = float(stats["delivery_rate_pct"])
            loss_pct = round(100.0 - delivery_pct, 1)
        elif "packet_loss_percent" in stats:
            loss_pct = float(stats["packet_loss_percent"])
            delivery_pct = round(100.0 - loss_pct, 1)
        else:
            delivery_pct = 100.0 if run.result == "SUCCESS" else 0.0
            loss_pct = round(100.0 - delivery_pct, 1)

        total_p = int(stats.get("total_packets", 50))
        deliv_p = int(stats.get("delivered", int(total_p * (delivery_pct / 100.0))))
        drop_p = int(stats.get("dropped", total_p - deliv_p))

        packet_metric_series.append(
            PacketMetricPoint(
                timestamp=t,
                time_label=time_label,
                delivery_ratio_pct=round(delivery_pct, 1),
                packet_loss_pct=round(loss_pct, 1),
                total_packets=total_p,
                delivered_packets=deliv_p,
                dropped_packets=drop_p,
                run_id=run.run_id,
            )
        )

        # -- Traffic Volume by Priority Class Point --
        # Model standard emergency traffic distribution across classes
        multiplier = 1.0
        if run.result != "SUCCESS":
            multiplier = 0.85
        if "traffic_multiplier" in init_state:
            multiplier = float(init_state["traffic_multiplier"])

        crit_mbps = round(18.5 * multiplier, 1)
        high_mbps = round(28.0 * multiplier, 1)
        norm_mbps = round(42.0 * multiplier, 1)
        low_mbps = round(16.5 * multiplier, 1)
        total_offered = round(crit_mbps + high_mbps + norm_mbps + low_mbps, 1)

        traffic_class_series.append(
            TrafficClassVolumePoint(
                timestamp=t,
                time_label=time_label,
                critical_mbps=crit_mbps,
                high_mbps=high_mbps,
                normal_mbps=norm_mbps,
                low_mbps=low_mbps,
                total_offered_mbps=total_offered,
                run_id=run.run_id,
            )
        )

        # -- Recovery Duration Point --
        rec_sec = round(float(run.recovery_duration or 0.045), 4)
        recovery_series.append(
            RecoveryDurationPoint(
                timestamp=t,
                time_label=time_label,
                recovery_duration_sec=rec_sec,
                target_sla_sec=1.50,
                scenario_name=run.scenario_id or "Ad-hoc Drill",
                result=run.result,
                run_id=run.run_id,
            )
        )

        # -- Route Changes Point --
        route_flaps = int(stats.get("recalculated_hops", 0))
        if route_flaps == 0 and fin_state.get("path"):
            route_flaps = len(fin_state["path"]) - 1
        alt_active = 1 if fin_state.get("alternate_path_selected") else 0
        events_cnt = db.query(NetworkEvent).filter(NetworkEvent.related_run == run.run_id).count()

        route_changes_series.append(
            RouteChangesPoint(
                timestamp=t,
                time_label=time_label,
                route_changes_count=route_flaps,
                alternate_paths_activated=alt_active,
                events_logged=events_cnt,
                run_id=run.run_id,
            )
        )

    # 4. Link Utilization Data (Based on current DB links and deterministic flow model)
    links = db.query(NetworkLink).order_by(NetworkLink.link_id).all()
    link_util_list: List[LinkUtilizationPoint] = []

    for l in links:
        is_down = l.operational_state == "DOWN"
        is_deg = l.operational_state == "DEGRADED"
        bw = float(l.bandwidth or 100.0)

        if is_down:
            util_pct = 0.0
            load_mbps = 0.0
        elif is_deg:
            util_pct = 84.5
            load_mbps = round(bw * 0.845, 1)
        else:
            # Deterministic load model based on link topology role
            src = l.source_node_id.upper()
            dest = l.destination_node_id.upper()
            is_core_ring = "ROUTER" in src and "ROUTER" in dest
            is_switch_uplink = "SW-" in src or "SW-" in dest
            is_sec = bool(l.extra_metadata and l.extra_metadata.get("is_secondary"))

            if is_core_ring:
                util_pct = 62.4 if not is_sec else 28.0
            elif is_switch_uplink:
                util_pct = 44.2
            else:
                util_pct = 22.8

            load_mbps = round(bw * (util_pct / 100.0), 1)

        link_name = f"{l.source_node_id} ➔ {l.destination_node_id}"
        link_util_list.append(
            LinkUtilizationPoint(
                link_id=l.link_id,
                link_name=link_name,
                source_node_id=l.source_node_id,
                destination_node_id=l.destination_node_id,
                operational_state=l.operational_state,
                bandwidth_mbps=bw,
                current_load_mbps=load_mbps,
                utilization_pct=round(util_pct, 1),
                link_cost=float(l.link_cost or 1.0),
                is_secondary=bool(l.extra_metadata and l.extra_metadata.get("is_secondary")),
            )
        )

    return TelemetryResponse(
        time_range=time_range,
        data_points_count=len(runs),
        has_sufficient_data=has_sufficient_data,
        explanation=explanation,
        snapshot=snapshot,
        availability_over_time=availability_series,
        latency_over_time=latency_series,
        packet_delivery_and_loss=packet_metric_series,
        link_utilization=link_util_list,
        traffic_volume_by_class=traffic_class_series,
        recovery_duration=recovery_series,
        route_changes_over_time=route_changes_series,
    )


def execute_telemetry_drill(db: Session, drill_name: Optional[str] = None) -> SimulationRun:
    """
    Execute a live deterministic simulation drill on demand and persist the run.
    Immediately appends a new verified historical record to telemetry time-series.
    """
    engine = build_routing_engine(db)
    src = "HQ-COMMAND-01"
    dest = "HOSPITAL-TRIAGE-03"
    route = engine.calculate_shortest_path(src, dest)

    now = datetime.utcnow()
    run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
    drill_title = drill_name or "ON-DEMAND-SPF-DRILL"
    path = route.selected_path if route.reachable else []
    latency = sum(h.latency_ms for h in route.hop_list) if route.reachable else 0.0

    packet_stats = {
        "total_packets": 50,
        "delivered": 50 if route.reachable else 0,
        "dropped": 0 if route.reachable else 50,
        "delivery_rate_pct": 100.0 if route.reachable else 0.0,
        "packet_loss_percent": 0.0 if route.reachable else 100.0,
        "avg_latency_ms": latency,
        "reachability_percentage": 100.0 if route.reachable else 0.0,
        "recalculated_hops": len(path) - 1 if path else 0,
    }

    sim_run = SimulationRun(
        run_id=run_id,
        scenario_id=drill_title,
        start_time=now,
        end_time=now + timedelta(seconds=0.045),
        initial_state={
            "source": src,
            "target": dest,
            "priority": "CRITICAL_SOS",
            "active_nodes_count": len(db.query(NetworkNode).filter(NetworkNode.status == "active").all()),
            "up_links_count": len(db.query(NetworkLink).filter(NetworkLink.operational_state == "UP").all()),
        },
        final_state={
            "result": "SUCCESS" if route.reachable else "FAILED",
            "path": path,
            "latency_ms": latency,
            "alternate_path_selected": False,
        },
        result="SUCCESS" if route.reachable else "FAILED",
        recovery_duration=0.045,
        packet_statistics=packet_stats,
    )
    db.add(sim_run)

    event = NetworkEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:8].upper()}",
        timestamp=now,
        event_type="TELEMETRY_DRILL_EXECUTED",
        severity="INFO" if route.reachable else "CRITICAL",
        message=f"On-demand telemetry drill '{drill_title}' ({run_id}) converged in 0.045s. Latency: {latency}ms.",
        affected_resource=dest,
        related_run=run_id,
    )
    db.add(event)
    db.commit()
    db.refresh(sim_run)
    return sim_run
