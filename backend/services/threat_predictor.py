from __future__ import annotations

from collections import Counter

from sqlalchemy.orm import Session

from app.models.threat_event import ThreatEvent
from app.services.lockdown_controller import get_security_state


def _severity(probability: int) -> str:
    if probability >= 85:
        return "CRITICAL"
    if probability >= 65:
        return "HIGH"
    if probability >= 35:
        return "MEDIUM"
    return "LOW"


def predict_threat(db: Session, telemetry: dict | None = None) -> dict:
    telemetry = telemetry or {}
    recent = db.query(ThreatEvent).order_by(ThreatEvent.created_at.desc()).limit(50).all()
    severity_counts = Counter([item.severity for item in recent])
    failed_logins = int(telemetry.get("failed_logins", severity_counts.get("high", 0) + severity_counts.get("critical", 0)))
    suspicious_ips = int(telemetry.get("suspicious_ips", len({item.source_ip for item in recent[:12]})))
    active_threats = int(telemetry.get("active_threats", severity_counts.get("high", 0) + severity_counts.get("critical", 0)))
    lockdown_active = get_security_state().get("lockdown", False)

    probability = 22
    if failed_logins > 10:
        probability += 35
    if suspicious_ips >= 3:
        probability += 18
    if active_threats >= 5:
        probability += 18
    if lockdown_active:
        probability += 12

    probability = min(99, probability)

    if failed_logins > 10:
        prediction = "Possible brute force attack incoming"
        action = "Enable brute-force protection, raise lockout thresholds, and block abusive IPs."
    elif suspicious_ips >= 4:
        prediction = "Suspicious distributed reconnaissance likely"
        action = "Increase detection sensitivity and monitor geo-distributed source patterns."
    elif active_threats >= 3:
        prediction = "Threat activity may escalate"
        action = "Increase monitoring intensity and prepare incident response playbooks."
    else:
        prediction = "Normal activity with low near-term risk"
        action = "Continue monitoring and maintain current defensive posture."

    severity = _severity(probability)

    return {
        "prediction": prediction,
        "probability_score": probability,
        "severity": severity,
        "recommended_action": action,
        "failed_logins": failed_logins,
        "suspicious_ips": suspicious_ips,
        "active_threats": active_threats,
        "mode": get_security_state().get("mode", "MONITORING"),
        "prediction_cards": [
            {
                "title": "Brute Force Confidence",
                "value": failed_logins,
                "hint": "Repeated authentication failures",
            },
            {
                "title": "Suspicious IPs",
                "value": suspicious_ips,
                "hint": "Unique hostile sources",
            },
            {
                "title": "Escalation Score",
                "value": probability,
                "hint": "Local rule-based forecast",
            },
        ],
    }
