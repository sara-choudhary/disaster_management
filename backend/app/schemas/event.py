from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class NetworkEventBase(BaseModel):
    event_id: str = Field(..., min_length=2, max_length=50, example="EVT-20261019-01")
    event_type: str = Field(..., example="NODE_OFFLINE")
    severity: str = Field(default="INFO", example="CRITICAL")
    message: str = Field(..., example="Repeater lost telemetry ping.")
    affected_resource: str = Field(..., example="RELAY-VALLEY-04")
    related_run: Optional[str] = Field(None, example="SIM-001")


class NetworkEventCreate(NetworkEventBase):
    pass


class NetworkEventResponse(NetworkEventBase):
    id: int
    timestamp: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class ForensicTimelineStep(BaseModel):
    step_number: int
    phase: str = Field(..., description="FAILURE_INJECTION, ROUTE_RECALCULATION, PACKET_AUDIT, ACCESS_CONTROL, RECOVERY_CONVERGENCE, ALERT_TRIGGERED")
    timestamp: datetime
    title: str
    description: str
    severity: str = "INFO"
    resource: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class ForensicTimelineResponse(BaseModel):
    run_id: str
    scenario_id: Optional[str] = None
    result: str
    start_time: datetime
    end_time: Optional[datetime] = None
    recovery_duration_sec: float
    initial_state: Dict[str, Any]
    final_state: Dict[str, Any]
    packet_statistics: Dict[str, Any]
    steps: List[ForensicTimelineStep]
    related_alerts: List[Dict[str, Any]]
    related_events: List[NetworkEventResponse]
    explanation: str
