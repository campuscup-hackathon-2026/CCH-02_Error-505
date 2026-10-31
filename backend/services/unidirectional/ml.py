"""Optional local anomaly inference. Rules remain operational without sklearn/model files."""
from __future__ import annotations
from pathlib import Path
from typing import Any

try:
    from sklearn.ensemble import IsolationForest
except ImportError:
    IsolationForest = None

FEATURES = ("packets_per_second", "bytes_per_second", "duration_seconds", "iat_mean", "iat_std", "outbound_inbound_ratio", "unique_ports", "unique_destinations")

class LocalAnomalyModel:
    version = "isolation-forest-demo-v1"
    def __init__(self) -> None:
        self.model: Any = None
        self.samples: list[list[float]] = []
    @property
    def available(self) -> bool: return self.model is not None
    def vector(self, flow: dict) -> list[float]: return [float(flow.get(item, 0) or 0) for item in FEATURES]
    def learn(self, flow: dict) -> None:
        if IsolationForest is None or len(self.samples) >= 1000: return
        self.samples.append(self.vector(flow))
        if len(self.samples) == 100:
            self.model = IsolationForest(contamination=.03, random_state=42, n_estimators=100).fit(self.samples)
    def score(self, flow: dict) -> float:
        if self.model is None: return 0.0
        return max(0.0, min(1.0, -float(self.model.decision_function([self.vector(flow)])[0]) + .5))

anomaly_model = LocalAnomalyModel()
