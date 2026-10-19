from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    alert_id: str = Field(..., min_length=2, max_length=50, example="ALT-20261019-01")
    severity: str = Field(default="MEDIUM", example="CRITICAL")
    category: str = Field(default="CONNECTIVITY", example="CONNECTIVITY")
    title: str = Field(..., example="Relay Outage Warning")
    description: str = Field(..., example="Node RELAY-VALLEY-04 has dropped off the mesh.")
    status: str = Field(default="ACTIVE", example="ACTIVE")
    affected_resource: Optional[str] = Field(default=None, example="ROUTER-01")
    related_run: Optional[str] = Field(default=None, example="RUN-12345678")


class AlertCreate(AlertBase):
    pass


class AlertUpdate(BaseModel):
    severity: Optional[str] = None
    category: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    affected_resource: Optional[str] = None
    related_run: Optional[str] = None


class AlertResponse(AlertBase):
    id: int
    timestamp: datetime
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
