from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AvailabilityPoint(BaseModel):
    timestamp: datetime
    time_label: str
    availability_pct: float
    node_availability_pct: float
    link_availability_pct: float
    reachability_pct: float
    run_id: Optional[str] = None
    drill_name: Optional[str] = None


class LatencyPoint(BaseModel):
    timestamp: datetime
    time_label: str
    estimated_latency_ms: float
    baseline_target_ms: float = 15.0
    warning_threshold_ms: float = 45.0
    run_id: Optional[str] = None


class PacketMetricPoint(BaseModel):
    timestamp: datetime
    time_label: str
    delivery_ratio_pct: float
    packet_loss_pct: float
    total_packets: int
    delivered_packets: int
    dropped_packets: int
    run_id: Optional[str] = None


class LinkUtilizationPoint(BaseModel):
    link_id: str
    link_name: str
    source_node_id: str
    destination_node_id: str
    operational_state: str
    bandwidth_mbps: float
    current_load_mbps: float
    utilization_pct: float
    link_cost: float
    is_secondary: bool = False


class TrafficClassVolumePoint(BaseModel):
    timestamp: datetime
    time_label: str
    critical_mbps: float = Field(..., description="Ambulance dispatch & hospital coordination")
    high_mbps: float = Field(..., description="Police & fire communication")
    normal_mbps: float = Field(..., description="Standard municipal communication")
    low_mbps: float = Field(..., description="Routine administrative traffic")
    total_offered_mbps: float
    run_id: Optional[str] = None


class RecoveryDurationPoint(BaseModel):
    timestamp: datetime
    time_label: str
    recovery_duration_sec: float
    target_sla_sec: float = 1.50
    scenario_name: str
    result: str
    run_id: str


class RouteChangesPoint(BaseModel):
    timestamp: datetime
    time_label: str
    route_changes_count: int
    alternate_paths_activated: int
    events_logged: int
    run_id: Optional[str] = None


class TelemetrySnapshot(BaseModel):
    total_simulation_runs: int
    current_health_score: float
    current_availability_pct: float
    current_avg_latency_ms: float
    active_nodes: int
    total_nodes: int
    active_links: int
    total_links: int
    active_alerts: int
    modeled_status: str


class TelemetryResponse(BaseModel):
    time_range: str
    data_points_count: int
    has_sufficient_data: bool
    explanation: Optional[str] = None
    snapshot: TelemetrySnapshot
    availability_over_time: List[AvailabilityPoint]
    latency_over_time: List[LatencyPoint]
    packet_delivery_and_loss: List[PacketMetricPoint]
    link_utilization: List[LinkUtilizationPoint]
    traffic_volume_by_class: List[TrafficClassVolumePoint]
    recovery_duration: List[RecoveryDurationPoint]
    route_changes_over_time: List[RouteChangesPoint]
    disclaimer: str = (
        "SIMULATED TELEMETRY NOTICE: All data points represent modeled algorithmic estimates "
        "derived from deterministic SPF routing convergence, discrete failure injection drills, "
        "and priority queue scheduling. They do not reflect physical operating system counters or live NIC telemetry."
    )
