"""Dedicated, payload-free persistence for SIH26145 passive analysis."""
from datetime import datetime
from sqlalchemy import DateTime, Float, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class UnidirectionalFlow(Base):
    __tablename__ = "unidirectional_flows"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    flow_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    source_ip: Mapped[str] = mapped_column(String(64), index=True)
    destination_ip: Mapped[str] = mapped_column(String(64), index=True)
    protocol: Mapped[str] = mapped_column(String(16), index=True)
    packet_count: Mapped[int] = mapped_column(Integer)
    byte_count: Mapped[int] = mapped_column(Integer)
    duration_seconds: Mapped[float] = mapped_column(Float)
    features: Mapped[dict] = mapped_column(JSON, default=dict)

class UnidirectionalAlert(Base):
    __tablename__ = "unidirectional_alerts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    alert_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    flow_id: Mapped[str] = mapped_column(String(64), index=True)
    threat_class: Mapped[str] = mapped_column(String(64), index=True)
    severity: Mapped[str] = mapped_column(String(16), index=True)
    confidence: Mapped[float] = mapped_column(Float)
    risk_score: Mapped[int] = mapped_column(Integer)
    source_ip: Mapped[str] = mapped_column(String(64), index=True)
    destination_ip: Mapped[str] = mapped_column(String(64), index=True)
    protocol: Mapped[str] = mapped_column(String(16))
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    detection_method: Mapped[str] = mapped_column(String(255))
    model_name: Mapped[str] = mapped_column(String(64))

class NetworkBaseline(Base):
    __tablename__ = "network_baselines"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_ip: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    sample_count: Mapped[int] = mapped_column(Integer, default=0)
    mean_bytes: Mapped[float] = mapped_column(Float, default=0)
    mean_packets: Mapped[float] = mapped_column(Float, default=0)

class ReplayBenchmark(Base):
    __tablename__ = "replay_benchmarks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    flows_tested: Mapped[int] = mapped_column(Integer)
    elapsed_seconds: Mapped[float] = mapped_column(Float)
    measured_flows_per_second: Mapped[float] = mapped_column(Float)
    result: Mapped[dict] = mapped_column(JSON, default=dict)
