from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class AccessRuleBase(BaseModel):
    rule_id: str = Field(..., min_length=2, max_length=50, example="RULE-01")
    source: str = Field(..., example="Emergency Services")
    destination: str = Field(..., example="Healthcare & Medical")
    protocol: str = Field(default="ANY", example="ANY")
    action: str = Field(default="PERMIT", example="PERMIT")
    enabled: bool = Field(default=True, example=True)


class AccessRuleCreate(AccessRuleBase):
    pass


class AccessRuleUpdate(BaseModel):
    source: Optional[str] = None
    destination: Optional[str] = None
    protocol: Optional[str] = None
    action: Optional[str] = None
    enabled: Optional[bool] = None


class AccessRuleResponse(AccessRuleBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ACLEvaluationRequest(BaseModel):
    source_department: Optional[str] = Field(default="Emergency Control Center", example="Emergency Control Center")
    destination_department: Optional[str] = Field(default="Hospital", example="Hospital")
    source_ip: Optional[str] = Field(None, example="192.168.10.10")
    destination_ip: Optional[str] = Field(None, example="192.168.40.10")
    protocol: str = Field(default="TCP", example="TCP")
    port: Optional[int] = Field(None, example=443)


class ACLEvaluationResponse(BaseModel):
    permitted: bool
    action: str
    matched_rule_id: Optional[str] = None
    matched_rule: Optional[AccessRuleResponse] = None
    explanation: str
    source_department: str
    destination_department: str
    source_vlan_id: int
    destination_vlan_id: int
    source_ip: str
    destination_ip: str
    protocol: str
    path_reachable: bool
    path: List[str]
    routing_status: str
    security_event_logged: bool
    disclaimer: str

