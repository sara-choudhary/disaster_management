from datetime import datetime
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ConciseSummaryResponse(BaseModel):
    network_availability_pct: Optional[float] = None
    failed_resources: List[str] = Field(default_factory=list)
    failed_resources_count: int = 0
    alternate_route_selected_count: int = 0
    total_drills_count: int = 0
    recovery_result: Dict[str, Any] = Field(default_factory=dict)
    packet_delivery_statistics: Dict[str, Any] = Field(default_factory=dict)
    security_events_count: int = 0
    recent_security_events: List[Dict[str, Any]] = Field(default_factory=list)
    qos_observations: Dict[str, Any] = Field(default_factory=dict)


class SummaryReportResponse(BaseModel):
    timestamp: datetime
    total_nodes: int
    active_nodes: int
    offline_nodes: int
    total_links: int
    up_links: int
    down_links: int
    network_health_score: float
    total_simulation_runs: int
    successful_simulations: int
    failed_simulations: int
    simulation_success_rate: float
    average_recovery_duration_sec: float
    active_alerts: int
    events_by_severity: Dict[str, int]
    # Concise Summary Fields
    concise_summary: Optional[ConciseSummaryResponse] = None
    network_availability_pct: Optional[float] = None
    failed_resources: List[str] = Field(default_factory=list)
    alternate_route_selected_count: int = 0
    recovery_result: Dict[str, Any] = Field(default_factory=dict)
    packet_delivery_statistics: Dict[str, Any] = Field(default_factory=dict)
    security_events_count: int = 0
    qos_observations: Dict[str, Any] = Field(default_factory=dict)


class SimulationHistoryItem(BaseModel):
    run_id: str
    scenario_id: Optional[str] = None
    scenario_name: str
    start_time: datetime
    completion_time: Optional[datetime] = None
    final_outcome: str
    recovery_duration_sec: Optional[float] = None
    packets_sent: Optional[int] = None
    packets_delivered: Optional[int] = None
    packets_lost: Optional[int] = None
    delivery_ratio_pct: Optional[float] = None
    alternate_route_selected: bool = False
    source: Optional[str] = None
    destination: Optional[str] = None


class SimulationHistoryPaginationResponse(BaseModel):
    total_count: int
    page: int
    page_size: int
    total_pages: int
    items: List[SimulationHistoryItem]


class SimulationRunReportResponse(BaseModel):
    run_id: str
    scenario_id: Optional[str] = None
    scenario_name: Optional[str] = None
    status: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: float
    packet_statistics: Dict[str, Any] = Field(default_factory=dict)
    route_taken: Optional[List[str]] = None
    alternate_route_selected: bool = False
    events_triggered: List[Dict[str, Any]] = Field(default_factory=list)
    alerts_triggered: List[Dict[str, Any]] = Field(default_factory=list)
    initial_topology: Dict[str, Any] = Field(default_factory=dict)
    final_topology: Dict[str, Any] = Field(default_factory=dict)
    route_changes: List[str] = Field(default_factory=list)
    resilience_score: float
    assessment: str
    qos_observations: Optional[str] = None
