from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.core.database import Base


class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), unique=True, index=True, nullable=False)
    department_type = Column(String(50), nullable=False, index=True)
    subnet = Column(String(50), nullable=False)
    gateway = Column(String(50), nullable=False)
    vlan_id = Column(Integer, nullable=False)
    priority = Column(Integer, default=5, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
