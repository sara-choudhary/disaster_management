from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
import enum
from app.core.database import Base


class NodeStatus(str, enum.Enum):
    ACTIVE = "active"
    DEGRADED = "degraded"
    OFFLINE = "offline"


class NodeType(str, enum.Enum):
    COMMAND_CENTER = "command_center"
    HOSPITAL = "hospital"
    RELAY = "relay"
    SHELTER = "shelter"
    FIELD_UNIT = "field_unit"


class NetworkNode(Base):
    __tablename__ = "network_nodes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    node_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    node_type = Column(String(50), default=NodeType.RELAY.value, nullable=False)
    status = Column(String(50), default=NodeStatus.ACTIVE.value, nullable=False)
    battery_level = Column(Float, default=100.0, nullable=False)
    pos_x = Column(Float, default=0.0, nullable=False)
    pos_y = Column(Float, default=0.0, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
