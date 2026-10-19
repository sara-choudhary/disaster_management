from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from app.core.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    alert_id = Column(String(50), unique=True, index=True, nullable=False)
    severity = Column(String(50), default="MEDIUM", nullable=False, index=True)
    category = Column(String(50), default="CONNECTIVITY", nullable=False, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False, index=True)
    affected_resource = Column(String(100), nullable=True, index=True)
    related_run = Column(String(50), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
