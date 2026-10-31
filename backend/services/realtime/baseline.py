from __future__ import annotations

import math
from collections import defaultdict


class AdaptiveBaseline:
    """Bounded EWMA statistics for observed, passive packet metadata."""

    def __init__(self, alpha: float = 0.08, minimum_samples: int = 30) -> None:
        self.alpha = alpha
        self.minimum_samples = minimum_samples
        self._stats = defaultdict(lambda: {"count": 0, "mean": 0.0, "variance": 0.0})

    def observe(self, key: str, value: float) -> dict[str, float | bool]:
        stat = self._stats[key]
        count, mean, variance = stat["count"], stat["mean"], stat["variance"]
        if count == 0:
            stat.update(count=1, mean=value, variance=0.0)
            return self.score(key, value)
        delta = value - mean
        mean += self.alpha * delta
        variance = (1 - self.alpha) * (variance + self.alpha * delta * delta)
        stat.update(count=count + 1, mean=mean, variance=variance)
        return self.score(key, value)

    def score(self, key: str, value: float) -> dict[str, float | bool]:
        stat = self._stats[key]
        deviation = abs(value - stat["mean"])
        stddev = math.sqrt(max(stat["variance"], 0.0))
        z_score = deviation / stddev if stddev > 0 else 0.0
        return {"ready": stat["count"] >= self.minimum_samples, "samples": stat["count"], "baseline": round(stat["mean"], 2), "stddev": round(stddev, 2), "current": round(value, 2), "z_score": round(z_score, 2), "deviation_ratio": round(value / stat["mean"], 2) if stat["mean"] else 0.0}

    def snapshot(self) -> dict[str, dict[str, float | int]]:
        return {key: {"samples": value["count"], "mean": round(value["mean"], 2), "stddev": round(math.sqrt(max(value["variance"], 0.0)), 2)} for key, value in self._stats.items()}
