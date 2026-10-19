from datetime import datetime
from typing import Dict, Any
from pydantic import BaseModel, Field


class HealthCheckResponse(BaseModel):
    status: str = Field(default="ok", example="ok")
    app_name: str = Field(..., example="Disaster-Resistant Emergency Communication Network")
    version: str = Field(default="1.0.0", example="1.0.0")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    database: str = Field(default="connected", example="connected")
    details: Dict[str, Any] = Field(default_factory=dict)
