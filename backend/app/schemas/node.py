from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import BaseModel, Field


class NodeBase(BaseModel):
    node_id: Optional[str] = Field(None, min_length=2, max_length=50, example="ECC-01")
    device_id: Optional[str] = Field(None, min_length=2, max_length=50, example="ECC-01")
    name: str = Field(..., min_length=2, max_length=100, example="Emergency Control Center")
    node_type: str = Field(default="command_center", example="command_center")
    department: str = Field(default="Emergency Services", example="Emergency Services")
    ip_address: str = Field(default="10.10.1.10", example="10.10.1.10")
    status: str = Field(default="active", example="active")
    battery_level: float = Field(default=100.0, ge=0.0, le=100.0, example=98.5)
    pos_x: float = Field(default=0.0, example=120.0)
    pos_y: float = Field(default=0.0, example=150.0)
    extra_metadata: Dict[str, Any] = Field(default_factory=dict)


class NodeCreate(NodeBase):
    def model_post_init(self, __context: Any) -> None:
        if self.node_id and not self.device_id:
            self.device_id = self.node_id
        elif self.device_id and not self.node_id:
            self.node_id = self.device_id


class NodeUpdate(BaseModel):
    name: Optional[str] = None
    node_type: Optional[str] = None
    department: Optional[str] = None
    ip_address: Optional[str] = None
    status: Optional[str] = None
    battery_level: Optional[float] = Field(None, ge=0.0, le=100.0)
    pos_x: Optional[float] = None
    pos_y: Optional[float] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class NodeResponse(NodeBase):
    id: int
    node_id: str
    device_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
