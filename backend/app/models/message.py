from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
import enum
from app.core.database import Base


class MessagePriority(str, enum.Enum):
    CRITICAL_SOS = "CRITICAL_SOS"
    HIGH_MEDICAL = "HIGH_MEDICAL"
    NORMAL_LOGISTICS = "NORMAL_LOGISTICS"
    LOW_ROUTINE = "LOW_ROUTINE"


class MessageStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    ROUTING = "ROUTING"
    DELIVERED = "DELIVERED"
    FAILED = "FAILED"
    DROPPED = "DROPPED"


class EmergencyMessage(Base):
    __tablename__ = "emergency_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    message_id = Column(String(50), unique=True, index=True, nullable=False)
    sender_id = Column(String(50), nullable=False)
    recipient_id = Column(String(50), nullable=False)
    priority = Column(String(50), default=MessagePriority.NORMAL_LOGISTICS.value, nullable=False)
    status = Column(String(50), default=MessageStatus.QUEUED.value, nullable=False)
    content = Column(Text, nullable=False)
    hop_count = Column(Integer, default=0, nullable=False)
    route_taken = Column(Text, default="", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    delivered_at = Column(DateTime, nullable=True)
