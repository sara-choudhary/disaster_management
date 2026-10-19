from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON
from app.core.database import Base


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    run_id = Column(String(50), unique=True, index=True, nullable=False)
    scenario_id = Column(String(50), nullable=True, index=True)
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, nullable=True)
    initial_state = Column(JSON, default=dict, nullable=False)
    final_state = Column(JSON, default=dict, nullable=False)
    result = Column(String(50), default="SUCCESS", nullable=False, index=True)
    recovery_duration = Column(Float, default=0.0, nullable=False)  # in seconds
    packet_statistics = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
