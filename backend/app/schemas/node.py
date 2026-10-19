from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class NodeBase(BaseModel):
    node_id: str = Field(..., min_length=2, max_length=50, example="node-alpha")
    name: str = Field(..., min_length=2, max_length=100, example="Central Command Center")
    node_type: str = Field(default="relay", example="command_center")
    status: str = Field(default="active", example="active")
    battery_level: float = Field(default=100.0, ge=0.0, le=100.0, example=98.5)
    pos_x: float = Field(default=0.0, example=150.0)
    pos_y: float = Field(default=0.0, example=200.0)


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    node_type: Optional[str] = None
    status: Optional[str] = None
    battery_level: Optional[float] = Field(None, ge=0.0, le=100.0)
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None


class NodeResponse(NodeBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
