from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
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
    ROUTER = "router"
    SWITCH = "switch"
    SERVER = "server"
    ENDPOINT = "endpoint"



class NetworkNode(Base):
    __tablename__ = "network_nodes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    device_id = Column(String(50), unique=True, index=True, nullable=False)
    node_id = Column(String(50), unique=True, index=True, nullable=False)  # Alias for backward compatibility
    name = Column(String(100), nullable=False, index=True)
    node_type = Column(String(50), default=NodeType.RELAY.value, nullable=False, index=True)
    department = Column(String(100), default="Emergency Services", nullable=False, index=True)
    ip_address = Column(String(50), default="10.10.1.10", nullable=False)
    status = Column(String(50), default=NodeStatus.ACTIVE.value, nullable=False, index=True)
    battery_level = Column(Float, default=100.0, nullable=False)
    pos_x = Column(Float, default=0.0, nullable=False)
    pos_y = Column(Float, default=0.0, nullable=False)
    extra_metadata = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __init__(self, **kwargs):
        # Sync device_id and node_id if only one is provided
        if "device_id" in kwargs and "node_id" not in kwargs:
            kwargs["node_id"] = kwargs["device_id"]
        elif "node_id" in kwargs and "device_id" not in kwargs:
            kwargs["device_id"] = kwargs["node_id"]
        if "extra_metadata" not in kwargs and "metadata" in kwargs:
            kwargs["extra_metadata"] = kwargs.pop("metadata")
        super().__init__(**kwargs)
