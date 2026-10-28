from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SimulationRunRequest(BaseModel):
    source_node_id: str = Field(..., example="ECC-01")
    target_node_id: str = Field(..., example="HOSPITAL-04")
    priority: str = Field(default="CRITICAL_SOS", example="CRITICAL_SOS")
    message_content: str = Field(..., example="Immediate evacuation required at sector 4.")
    simulate_node_failures: Optional[List[str]] = Field(default_factory=list, example=["RELAY-VALLEY-04"])


class SimulationCreateRequest(BaseModel):
    scenario_id: Optional[str] = Field(None, example="SCEN-QUAKE-01")
    source_node_id: Optional[str] = Field(None, example="ECC-01")
    target_node_id: Optional[str] = Field(None, example="HOSPITAL-04")
    priority: Optional[str] = Field("CRITICAL_SOS", example="CRITICAL_SOS")
    message_content: Optional[str] = Field("Emergency priority dispatch test", example="Emergency priority dispatch test")
    simulate_node_failures: Optional[List[str]] = Field(default_factory=list, example=["RELAY-VALLEY-04"])
    packet_count: Optional[int] = Field(10, ge=1, le=1000)



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
    transmission_attempts: int = 1
    retransmissions: int = 0
    alternate_route_selected: bool = False
    retry_log: Optional[List[str]] = None


class SimulationRunRecordResponse(BaseModel):
    id: int
    run_id: str
    scenario_id: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    initial_state: Dict[str, Any]
    final_state: Dict[str, Any]
    result: str
    recovery_duration: float
    packet_statistics: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
