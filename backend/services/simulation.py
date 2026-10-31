import random
from datetime import datetime


SIMULATED_ATTACKS = [
    {"event_type": "brute_force", "severity": "high", "description": "Burst of failed logins detected"},
    {"event_type": "prompt_injection", "severity": "medium", "description": "Injection phrase found in AI prompt"},
    {"event_type": "ddos_like_pattern", "severity": "critical", "description": "Abnormal traffic spike above baseline"},
    {"event_type": "credential_stuffing", "severity": "high", "description": "Repeated username/password spray attempt"},
]


def simulated_attack_event() -> dict:
    event = random.choice(SIMULATED_ATTACKS)
    return {
        "event_type": event["event_type"],
        "severity": event["severity"],
        "description": event["description"],
        "source_ip": f"10.0.{random.randint(1, 20)}.{random.randint(1, 254)}",
        "confidence": round(random.uniform(0.65, 0.99), 2),
        "metadata": {
            "attempts": random.randint(3, 120),
            "region": random.choice(["us-east", "eu-west", "ap-south"]),
            "protocol": random.choice(["https", "ssh", "api"]),
        },
        "created_at": datetime.utcnow().isoformat(),
    }
