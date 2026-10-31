"""Rolling, in-memory behavioral baselines for passive flow analysis."""
from __future__ import annotations

from collections import defaultdict, deque
from statistics import fmean, pstdev

WINDOWS = {"1m": 60, "5m": 300, "15m": 900, "1h": 3600, "24h": 86400}


class RollingBaselines:
    def __init__(self) -> None:
        self._values: dict[str, deque[tuple[float, float]]] = defaultdict(lambda: deque(maxlen=5000))

    def compare(self, key: str, value: float, timestamp: float) -> dict[str, float | int]:
        history = self._values[key]
        recent = [item for seen, item in history if timestamp - seen <= WINDOWS["24h"]]
        if len(recent) < 10:
            return {"sample_count": len(recent), "mean": 0.0, "stddev": 0.0, "deviation_sigma": 0.0}
        mean = fmean(recent); stddev = pstdev(recent) or 1.0
        return {"sample_count": len(recent), "mean": round(mean, 3), "stddev": round(stddev, 3), "deviation_sigma": round((value - mean) / stddev, 3)}

    def observe(self, key: str, value: float, timestamp: float) -> None:
        self._values[key].append((timestamp, value))
