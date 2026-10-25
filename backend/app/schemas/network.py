from datetime import datetime
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

from app.schemas.node import NodeResponse
from app.schemas.link import NetworkLinkResponse
from app.schemas.department import DepartmentResponse


class NetworkTopologyResponse(BaseModel):
    nodes: List[NodeResponse]
    links: List[NetworkLinkResponse]
    departments: List[DepartmentResponse]
    metrics: Dict[str, Any]
    subnets: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = "ok"



class NetworkMetricsResponse(BaseModel):
    total_nodes: int
    active_nodes: int
    offline_nodes: int
    degraded_nodes: int
    total_links: int
    up_links: int
    down_links: int
    degraded_links: int
    average_latency_ms: float
    total_bandwidth_mbps: float
    network_health_score: float
    active_alerts_count: int


class RoutePathResponse(BaseModel):
    source: str
    destination: str
    priority: str = "CRITICAL_SOS"
    path_exists: bool = True
    reachability: bool = True
    status: str = "OPTIMAL"
    hops: int = 0
    cost: Optional[float] = 0.0
    estimated_latency_ms: float = 0.0
    path: List[str] = Field(default_factory=list)
    next_hop: Optional[str] = None
    hop_list: List[Dict[str, Any]] = Field(default_factory=list)
    alternate_path_selected: bool = False
    route_changes: List[str] = Field(default_factory=list)
    algorithm: str = "OSPF-Inspired SPF (Dijkstra)"


class RoutingTableResponse(BaseModel):
    node_id: str
    entries_count: int
    table: Dict[str, Any]



class FailureReasonPayload(BaseModel):
    reason: Optional[str] = Field(
        default="Manual administrative drill / simulated failure",
        example="Physical cable severance / seismic damage",
    )


class RecoveryMetrics(BaseModel):
    detection_delay_ms: float
    spf_calculation_ms: float
    fib_update_ms: float
    propagation_delay_ms: float
    total_recovery_duration_sec: float
    reachability_percentage: float
    timing_model: str = "BFD (3x Keepalive) + Dijkstra SPF + Hardware FIB + Path Propagation Delay"


class FailureInjectionResponse(BaseModel):
    status: str = "success"
    message: str = ""
    resource_id: str = ""
    resource_type: str = "link"  # "link" or "node"
    action: str = "FAILED"        # "FAILED" or "RESTORED"
    link: Optional[NetworkLinkResponse] = None
    node: Optional[NodeResponse] = None
    recovery_metrics: Optional[RecoveryMetrics] = None
    before_path: Optional[List[str]] = None
    after_path: Optional[List[str]] = None
    alternate_path_selected: bool = False
    route_changes: List[str] = Field(default_factory=list)
    reachability: Dict[str, bool] = Field(default_factory=dict)
    simulation_run_id: Optional[str] = None


class LinkActionResponse(FailureInjectionResponse):
    pass


class NodeActionResponse(FailureInjectionResponse):
    pass


class BaselineResetResponse(BaseModel):
    status: str = "success"
    message: str
    restored_nodes_count: int
    restored_links_count: int
    resolved_alerts_count: int
    historical_runs_preserved: int
    historical_events_preserved: int
    timestamp: datetime


class ReachabilityMatrixResponse(BaseModel):
    source_node_id: str
    total_destinations: int
    reachable_destinations: int
    reachability_percentage: float
    destinations: Dict[str, Dict[str, Any]]


class AlternativeRouteItem(BaseModel):
    rank: int
    path: List[str]
    total_cost: float
    hop_count: int
    role: str
    valid_after_failure: bool = True


class AlgorithmComparisonItem(BaseModel):
    algorithm_key: str
    algorithm_name: str
    path: List[str]
    total_cost: Optional[float] = None
    hop_count: int = 0
    reachable: bool = False
    execution_time_ms: float = 0.0
    time_complexity: str
    space_complexity: str
    purpose: str
    assumptions: str
    scalability_warning: Optional[str] = None
    is_optimal: bool = True
    ranked_alternatives: Optional[List[AlternativeRouteItem]] = None


class AlgorithmComparisonResponse(BaseModel):
    source: str
    destination: str
    active_nodes_count: int
    active_links_count: int
    k_paths_requested: int = 3
    algorithms: List[AlgorithmComparisonItem]
    all_pairs_matrix_summary: Optional[Dict[str, Any]] = None
    educational_notes: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


