from __future__ import annotations

import random
from datetime import datetime


COUNTRIES = [
    {"country": "USA", "lat": 37.0902, "lon": -95.7129},
    {"country": "China", "lat": 35.8617, "lon": 104.1954},
    {"country": "Russia", "lat": 61.524, "lon": 105.3188},
    {"country": "Germany", "lat": 51.1657, "lon": 10.4515},
    {"country": "India", "lat": 20.5937, "lon": 78.9629},
]

FEED_LINES = [
    ("CRITICAL", "Ransomware campaign detected"),
    ("HIGH", "Zero-day exploit active"),
    ("MEDIUM", "Credential stuffing attempt"),
    ("HIGH", "API token abuse spike"),
    ("LOW", "Recon sweep observed"),
]


def generate_demo_feed_item() -> dict:
    severity, headline = random.choice(FEED_LINES)
    country = random.choice(COUNTRIES)
    attack_count = random.randint(3, 42)

    return {
        "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
        "severity": severity,
        "headline": headline,
        "country": country["country"],
        "lat": country["lat"],
        "lon": country["lon"],
        "attack_count": attack_count,
        "counter_label": f"{country['country']} / {headline}",
    }


def generate_demo_notification(item: dict) -> dict:
    return {
        "title": f"{item['severity']} {item['headline']}",
        "message": f"{item['country']} has {item['attack_count']} new simulated alerts.",
        "tone": item["severity"].lower(),
        "timestamp": item["timestamp"],
    }
