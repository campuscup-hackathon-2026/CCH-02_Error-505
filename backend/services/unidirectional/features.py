"""Reusable payload-free flow feature calculations."""
from __future__ import annotations
import math
from collections import Counter

def shannon_entropy(values: list[str]) -> float:
    text = "".join(values)
    if not text: return 0.0
    counts = Counter(text)
    return -sum((count / len(text)) * math.log2(count / len(text)) for count in counts.values())

def ngram_score(label: str) -> float:
    if len(label) < 3: return 0.0
    uncommon = sum(1 for char in label.lower() if char.isdigit() or char in "qzxjkv")
    return min(1.0, uncommon / len(label) * 2)

def direction_bytes(source_is_protected: bool | None, total: int) -> tuple[int, int, str]:
    if source_is_protected is True: return 1, total, "OUTBOUND"
    if source_is_protected is False: return total, 1, "INBOUND"
    return 0, 0, "OBSERVED"
