from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class TrafficClass(Base):
    __tablename__ = "traffic_classes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    priority = Column(Integer, default=3, nullable=False, index=True)
    bandwidth_req = Column(Float, default=1.0, nullable=False)  # in Mbps
    latency_budget = Column(Float, default=50.0, nullable=False) # in ms
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
