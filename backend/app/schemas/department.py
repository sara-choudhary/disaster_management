from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class DepartmentBase(BaseModel):
    code: str = Field(..., min_length=2, max_length=50, example="ECC")
    name: str = Field(..., min_length=2, max_length=100, example="Emergency Control Center")
    department_type: str = Field(default="command", example="command")
    subnet: str = Field(..., example="10.10.1.0/24")
    gateway: str = Field(..., example="10.10.1.1")
    vlan_id: int = Field(default=100, example=101)
    priority: int = Field(default=5, ge=1, le=10, example=1)


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    department_type: Optional[str] = None
    subnet: Optional[str] = None
    gateway: Optional[str] = None
    vlan_id: Optional[int] = None
    priority: Optional[int] = None


class DepartmentResponse(DepartmentBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
