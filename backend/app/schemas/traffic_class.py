from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class TrafficClassBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, example="CRITICAL")
    name: str = Field(..., min_length=2, max_length=100, example="Ambulance Dispatch and Hospital Coordination")
    priority: int = Field(default=1, ge=1, le=10, example=1)
    bandwidth_req: float = Field(default=0.5, ge=0.01, example=2.0)  # Mbps
    latency_budget: float = Field(default=50.0, ge=1.0, example=20.0) # ms


class TrafficClassCreate(TrafficClassBase):
    pass


class TrafficClassResponse(TrafficClassBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class QoSSimulationRequest(BaseModel):
    source_department: str = Field(default="Emergency Control Center", example="Emergency Control Center")
    destination_department: str = Field(default="Hospital", example="Hospital")
    traffic_class: str = Field(default="CRITICAL", example="CRITICAL")
    packet_count: int = Field(default=100, ge=10, le=50000, example=100)
    offered_load_mbps: float = Field(default=60.0, ge=0.1, le=10000.0, example=60.0)
    test_duration_sec: float = Field(default=10.0, ge=1.0, le=300.0, example=10.0)
    competing_traffic: bool = Field(default=True, example=True)
    scheduler_policy: str = Field(
        default="strict_priority_with_safeguards",
        example="strict_priority_with_safeguards",
    )


class ClassQoSResult(BaseModel):
    traffic_class: str
    class_name: str
    priority: int
    offered_mbps: float
    allocated_mbps: float
    packets_sent: int
    packets_delivered: int
    packets_lost: int
    delivery_ratio_pct: float
    estimated_latency_ms: float
    queue_delay_ms: float
    status: str


class QoSSimulationResponse(BaseModel):
    simulation_id: str
    timestamp: datetime
    source_department: str
    destination_department: str
    selected_class: str
    path: List[str]
    bottleneck_link_id: str
    bottleneck_capacity_mbps: float
    total_offered_load_mbps: float
    link_utilization_pct: float
    is_congested: bool
    scheduler_policy: str
    test_duration_sec: float
    packets_sent: int
    packets_delivered: int
    packets_lost: int
    delivery_ratio_pct: float
    estimated_latency_ms: float
    queue_delay_ms: float
    results_by_class: List[ClassQoSResult]
    simulated_estimate_notice: str
    qos_vs_routing_explanation: str

