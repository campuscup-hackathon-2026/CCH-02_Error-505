from __future__ import annotations

import json
import re
from collections import Counter

from app.services.local_ai import summarize_with_ollama


FAILED_LOGIN_PATTERNS = [
    r"failed password",
    r"invalid password",
    r"authentication failed",
    r"login failed",
    r"permission denied",
]

IP_PATTERN = re.compile(r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b")


def _severity(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 65:
        return "HIGH"
    if score >= 35:
        return "MEDIUM"
    return "LOW"


def _split_logs(logs: str | list[str]) -> list[str]:
    if isinstance(logs, list):
        return [str(item).strip() for item in logs if str(item).strip()]
    return [line.strip() for line in str(logs).splitlines() if line.strip()]


def _display_text(value, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value
    if isinstance(value, dict):
        preferred_keys = ("summary", "description", "result", "recommendation")
        for key in preferred_keys:
            nested = value.get(key)
            if isinstance(nested, str) and nested.strip():
                return nested

        readable = []
        labels = {
            "total_logs": "total logs",
            "total_alerts": "total alerts",
            "threat_score": "threat score",
            "highest_severity": "highest severity",
            "highest_confidence": "highest confidence",
        }
        for key, label in labels.items():
            if key in value:
                readable.append(f"{label}: {value[key]}")
        if "alerts_by_type" in value:
            readable.append(f"alerts by type: {value['alerts_by_type']}")
        return ", ".join(readable) if readable else json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        return "; ".join(str(item) for item in value) or fallback
    if value is not None:
        return str(value)
    return fallback


async def analyze_logs(logs: str | list[str]) -> dict:
    lines = _split_logs(logs)
    ip_counter: Counter[str] = Counter()
    suspicious_lines: list[str] = []
    score = min(10, len(lines))

    for line in lines:
        lower = line.lower()
        ips = IP_PATTERN.findall(line)
        for ip in ips:
            ip_counter[ip] += 1

        if any(re.search(pattern, lower) for pattern in FAILED_LOGIN_PATTERNS):
            suspicious_lines.append(line)
            score += 10

        if re.search(r"brute force|credential stuffing|rapid retry|multiple failed", lower):
            suspicious_lines.append(line)
            score += 14

        if re.search(r"ssh|admin|root|password|authentication", lower) and re.search(r"failed|denied|invalid", lower):
            score += 8

    repeated_ips = [ip for ip, count in ip_counter.items() if count >= 4]
    if repeated_ips:
        score += 20
        suspicious_lines.append(f"Repeated source IPs: {', '.join(repeated_ips)}")

    score = min(99, score)
    severity = _severity(score)

    fallback_summary = (
        f"Analyzed {len(lines)} log lines. Detected {len(suspicious_lines)} suspicious indicators and {len(repeated_ips)} repeated IP patterns."
    )
    summary = await summarize_with_ollama(
        "Summarize security logs in concise SOC language.",
        f"Logs:\n{chr(10).join(lines[:60])}\nIndicators: {suspicious_lines}",
        fallback_summary,
    )
    summary = _display_text(summary, fallback_summary)

    terminal_lines = [
        "Ingesting log file...",
        "Parsing authentication events...",
        "Scanning for brute force and repeated failures...",
        f"High-risk score: {score}/100...",
        "Generating AI-style summary...",
    ]

    return {
        "risk_score": score,
        "severity": severity,
        "summary": summary,
        "result": "Suspicious authentication activity detected" if score >= 35 else "No major anomalies found",
        "anomalies": suspicious_lines[:12],
        "repeated_ips": repeated_ips,
        "total_lines": len(lines),
        "failed_login_count": len(suspicious_lines),
        "recommended_action": "Review impacted accounts, block abusive IPs, and reset exposed credentials.",
        "terminal_logs": terminal_lines,
    }
