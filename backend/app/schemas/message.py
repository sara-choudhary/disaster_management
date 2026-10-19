from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class MessageBase(BaseModel):
    sender_id: str = Field(..., min_length=2, max_length=50, example="node-alpha")
    recipient_id: str = Field(..., min_length=2, max_length=50, example="node-beta")
    priority: str = Field(default="NORMAL_LOGISTICS", example="CRITICAL_SOS")
    content: str = Field(..., min_length=1, max_length=1000, example="Medical supplies depleted at Field Hospital A")


class MessageCreate(MessageBase):
    pass


class MessageResponse(MessageBase):
    id: int
    message_id: str
    status: str
    hop_count: int
    route_taken: str
    created_at: datetime
    delivered_at: Optional[datetime] = None

    class Config:
        from_attributes = True
