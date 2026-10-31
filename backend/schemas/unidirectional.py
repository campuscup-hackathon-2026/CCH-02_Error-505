from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NormalizedFlow(BaseModel):
    """Payload-free observation emitted by every passive traffic source."""
    flow_id: str | None = None
    timestamp: datetime | None = None
    source_ip: str
    destination_ip: str
    source_port: int = Field(0, ge=0, le=65535)
    destination_port: int = Field(0, ge=0, le=65535)
    protocol: str = "TCP"
    packet_count: int = Field(1, ge=1)
    byte_count: int = Field(0, ge=0)
    duration_seconds: float = Field(1, gt=0)
    direction: str = "OBSERVED"
    iat_mean: float = Field(0, ge=0)
    iat_std: float = Field(0, ge=0)
    dns_queries: list[str] = Field(default_factory=list, max_length=50)
    unique_ports: int = Field(1, ge=1)
    unique_destinations: int = Field(1, ge=1)
    inbound_bytes: int = Field(1, ge=0)
    outbound_bytes: int = Field(0, ge=0)
    ja3: str | None = None
    ja3s: str | None = None
    ja4: str | None = None
    tls_version: str | None = None
    cipher: str | None = None
    dns_record_types: list[str] = Field(default_factory=list, max_length=50)


class StandardAlert(BaseModel):
    alert_id: str
    timestamp: str
    flow_id: str
    threat_class: str
    severity: str
    confidence: float
    risk_score: int
    source: dict[str, Any]
    destination: dict[str, Any]
    protocol: str
    evidence: dict[str, Any]
    features: dict[str, Any] = Field(default_factory=dict)
    baseline_comparison: dict[str, Any] = Field(default_factory=dict)
    detection_method: str = "heuristic+statistical"
    model: str = "ensemble-v1"
    metadata_only: bool = True


class ReplayRequest(BaseModel):
    scenarios: list[str] = Field(default_factory=lambda: ["ddos", "c2", "dga", "dns-tunnel", "port-scan", "exfiltration"])
    speed: float = Field(1, ge=.5, le=100)
