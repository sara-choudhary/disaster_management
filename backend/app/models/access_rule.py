from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime
from app.core.database import Base


class AccessRule(Base):
    __tablename__ = "access_rules"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rule_id = Column(String(50), unique=True, index=True, nullable=False)
    source = Column(String(100), nullable=False, index=True)
    destination = Column(String(100), nullable=False, index=True)
    protocol = Column(String(20), default="ANY", nullable=False)
    action = Column(String(20), default="PERMIT", nullable=False)
    enabled = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
