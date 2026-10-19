from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SimulationRunRequest(BaseModel):
    source_node_id: str = Field(..., example="node-alpha")
    target_node_id: str = Field(..., example="node-delta")
    priority: str = Field(default="CRITICAL_SOS", example="CRITICAL_SOS")
    message_content: str = Field(..., example="Immediate evacuation required at sector 4.")
    simulate_node_failures: Optional[List[str]] = Field(default_factory=list, example=["node-gamma"])


class HopDetail(BaseModel):
    step: int
    from_node: str
    to_node: str
    latency_ms: float
    status: str
    remaining_battery: float


class SimulationRunResponse(BaseModel):
    simulation_id: str
    success: bool
    priority: str
    source_node_id: str
    target_node_id: str
    path: List[str]
    total_hops: int
    total_latency_ms: float
    delivery_status: str
    details: List[HopDetail]
    message_id: str
