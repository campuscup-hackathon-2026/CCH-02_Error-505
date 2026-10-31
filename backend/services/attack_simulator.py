from __future__ import annotations

import random
from datetime import datetime

from app.services.ai_provider import ai_provider


ATTACK_LIBRARY = [
    {
        "attack": "SQL Injection",
        "target": "Customer Login Portal",
        "severity": "HIGH",
        "status": "Blocked",
        "indicators": ["UNION SELECT", "OR 1=1", "comment truncation"],
    },
    {
        "attack": "Prompt Injection",
        "target": "AI Copilot",
        "severity": "CRITICAL",
        "status": "Blocked",
        "indicators": ["ignore previous instructions", "exfiltrate system prompt", "override guardrails"],
    },
    {
        "attack": "XSS Attack",
        "target": "Incident Response Console",
        "severity": "MEDIUM",
        "status": "Contained",
        "indicators": ["<script>", "onerror=", "payload obfuscation"],
    },
    {
        "attack": "API Abuse",
        "target": "Threat Intelligence API",
        "severity": "HIGH",
        "status": "Blocked",
        "indicators": ["burst requests", "token spray", "quota exhaustion"],
    },
    {
        "attack": "Brute Force Login",
        "target": "Admin Authentication",
        "severity": "HIGH",
        "status": "Blocked",
        "indicators": ["failed logins", "credential spray", "rapid retries"],
    },
    {
        "attack": "Malware Upload Attempt",
        "target": "File Upload Gateway",
        "severity": "CRITICAL",
        "status": "Neutralized",
        "indicators": ["archive masquerade", "embedded loader", "malicious hash"],
    },
]


def _risk_score(severity: str) -> int:
    weights = {
        "LOW": (12, 33),
        "MEDIUM": (34, 59),
        "HIGH": (60, 84),
        "CRITICAL": (85, 99),
    }
    low, high = weights.get(severity.upper(), (30, 75))
    return random.randint(low, high)


def generate_attack_event() -> dict:
    template = random.choice(ATTACK_LIBRARY)
    risk_score = _risk_score(template["severity"])
    timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    source_octets = (random.randint(10, 223), random.randint(0, 255), random.randint(1, 254))

    return {
        "timestamp": timestamp,
        "attack": template["attack"],
        "attack_type": template["attack"],
        "severity": template["severity"],
        "target": template["target"],
        "status": template["status"],
        "risk_score": risk_score,
        "source_ip": f"10.{source_octets[0]}.{source_octets[1]}.{source_octets[2]}",
        "indicators": random.sample(template["indicators"], k=min(2, len(template["indicators"]))),
    }


def build_terminal_logs(event: dict) -> list[str]:
    return [
        f"Scanning target: {event['target']}...",
        f"Attack detected: {event['attack']} [{event['severity']}]",
        f"Risk score evaluated at {event['risk_score']}/100...",
        f"Firewall state: {event['status']}...",
        "Threat neutralized...",
        "Generating AI report...",
    ]


async def build_ai_analysis(event: dict) -> dict:
    fallback = {
        "what_it_is": f"{event['attack']} is a simulated cyber attack targeting {event['target']}.",
        "why_dangerous": "It can expose sensitive data, degrade service availability, or compromise AI safety controls.",
        "mitigation_steps": [
            "Inspect request logs and isolate the impacted surface.",
            "Confirm firewall, validation, and auth controls are active.",
            "Escalate to incident response if the pattern repeats.",
        ],
        "recommended_fixes": [
            "Tighten input validation and request filtering.",
            "Increase detection signatures for the observed attack pattern.",
            "Review access tokens, rate limits, and logging coverage.",
        ],
        "copilot_summary": "SentinelAI Copilot recommends immediate containment, evidence collection, and validation of the exposed control surface.",
    }

    prompt = (
        f"Attack: {event['attack']}\n"
        f"Target: {event['target']}\n"
        f"Severity: {event['severity']}\n"
        f"Status: {event['status']}\n"
        f"Risk score: {event['risk_score']}\n"
        "Return JSON with keys: what_it_is, why_dangerous, mitigation_steps, recommended_fixes, copilot_summary. "
        "Keep the response short, practical, and suitable for a SOC operator."
    )

    result = await ai_provider.complete_json(
        system_prompt=(
            "You are SentinelAI OS. Explain cyber attacks in plain defensive language and recommend mitigation steps. "
            "Focus on practical SOC actions, not offensive details."
        ),
        user_prompt=prompt,
        fallback=fallback,
    )

    result.setdefault("what_it_is", fallback["what_it_is"])
    result.setdefault("why_dangerous", fallback["why_dangerous"])
    result.setdefault("mitigation_steps", fallback["mitigation_steps"])
    result.setdefault("recommended_fixes", fallback["recommended_fixes"])
    result.setdefault("copilot_summary", fallback["copilot_summary"])
    return result
