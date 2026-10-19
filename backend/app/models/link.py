from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from app.core.database import Base


class NetworkLink(Base):
    __tablename__ = "network_links"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    link_id = Column(String(50), unique=True, index=True, nullable=False)
    source_node_id = Column(String(50), ForeignKey("network_nodes.node_id", ondelete="CASCADE"), nullable=False, index=True)
    destination_node_id = Column(String(50), ForeignKey("network_nodes.node_id", ondelete="CASCADE"), nullable=False, index=True)
    bandwidth = Column(Float, default=100.0, nullable=False)  # in Mbps
    latency = Column(Float, default=10.0, nullable=False)     # in ms
    operational_state = Column(String(50), default="UP", nullable=False, index=True)  # UP, DEGRADED, DOWN
    link_cost = Column(Float, default=1.0, nullable=False)
    link_type = Column(String(50), default="ordinary", nullable=False)  # ordinary, backbone, secondary, distribution, access
    extra_metadata = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __init__(self, **kwargs):
        if "link_type" not in kwargs:
            kwargs["link_type"] = "ordinary"
        if "extra_metadata" not in kwargs:
            kwargs["extra_metadata"] = {}
        super().__init__(**kwargs)
