from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.threat_event import ThreatEvent
from app.services.lockdown_controller import get_security_state


def build_recommendations(db: Session, telemetry: dict | None = None) -> dict:
    telemetry = telemetry or {}
    risk_score = int(telemetry.get("risk_score", 0))
    recent_threats = db.query(ThreatEvent).order_by(ThreatEvent.created_at.desc()).limit(25).all()
    high_threats = sum(1 for item in recent_threats if item.severity.lower() in {"high", "critical"})
    critical_threats = sum(1 for item in recent_threats if item.severity.lower() == "critical")
    mode = get_security_state().get("mode", "MONITORING")

    recommendations: list[dict] = []

    if risk_score > 80 or mode == "LOCKDOWN":
        recommendations.append({"priority": "critical", "text": "Enable firewall lockdown mode"})
    if high_threats >= 3:
        recommendations.append({"priority": "high", "text": "Restrict external API traffic"})
    if critical_threats >= 2:
        recommendations.append({"priority": "high", "text": "Block suspicious IP activity"})
    if telemetry.get("malware_hits", 0) or critical_threats > 0:
        recommendations.append({"priority": "critical", "text": "Run malware isolation scan"})
    if not recommendations:
        recommendations.extend([
            {"priority": "medium", "text": "Continue network monitoring"},
            {"priority": "medium", "text": "Keep endpoint rules synchronized"},
        ])

    recommendations.extend(
        [
            {"priority": "medium", "text": "Harden authentication thresholds"},
            {"priority": "low", "text": "Review prompt firewall tuning"},
        ]
    )

    return {
        "mode": mode,
        "risk_score": risk_score,
        "high_threats": high_threats,
        "critical_threats": critical_threats,
        "recommendations": recommendations[:6],
        "recommended_actions": [item["text"] for item in recommendations[:6]],
    }
