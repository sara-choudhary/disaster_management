from datetime import datetime
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class ScenarioBase(BaseModel):
    scenario_id: str = Field(..., min_length=2, max_length=50, example="SCEN-QUAKE-01")
    name: str = Field(..., min_length=2, max_length=100, example="Earthquake Fault Rupture")
    description: str = Field(..., example="Simulates seismic failure of northern relay towers.")
    scenario_type: str = Field(default="drill", example="earthquake")
    configuration: Dict[str, Any] = Field(default_factory=dict)


class ScenarioCreate(ScenarioBase):
    pass


class ScenarioResponse(ScenarioBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
