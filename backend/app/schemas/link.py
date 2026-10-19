from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class LinkBase(BaseModel):
    link_id: str = Field(..., min_length=2, max_length=50, example="LINK-R1-R2")
    source_node_id: str = Field(..., example="ROUTER-01")
    destination_node_id: str = Field(..., example="ROUTER-02")
    bandwidth: float = Field(default=100.0, ge=0.1, example=1000.0)
    latency: float = Field(default=10.0, ge=0.1, example=2.0)
    operational_state: str = Field(default="UP", example="UP")
    link_cost: float = Field(default=1.0, ge=0.1, example=1.0)
    link_type: str = Field(default="ordinary", example="backbone")
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)


class NetworkLinkCreate(LinkBase):
    pass


class NetworkLinkUpdate(BaseModel):
    bandwidth: Optional[float] = None
    latency: Optional[float] = None
    operational_state: Optional[str] = None
    link_cost: Optional[float] = None
    link_type: Optional[str] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class NetworkLinkResponse(LinkBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
