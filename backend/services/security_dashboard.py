from __future__ import annotations

import asyncio
from collections import Counter
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.threat_event import ThreatEvent
from app.models.vulnerability import VulnerabilityScan
from app.services.ai_provider import ai_provider
from app.services.threat_intelligence import ThreatIntelligence


class SecurityDashboard:
    MODULE_LABELS = {
        "vulnerability_intelligence": "Vulnerability Intel",
        "ai_analyst": "AI Analyst",
        "prompt_firewall": "Prompt Firewall",
        "attack_simulator": "Attack Simulator",
        "threat_hunter": "Threat Hunter",
        "incident_response": "Incident Response",
        "ai_copilot": "Security Copilot",
        "reporting": "Reporting",
        "dashboard": "Dashboard",
        "auth": "Auth",
        "system": "System",
    }

    @staticmethod
    def _heatmap(rows: list[ThreatEvent]) -> list[dict]:
        buckets = Counter()
        for row in rows:
            hour = row.created_at.strftime("%H:00")
            buckets[(hour, row.severity)] += 1

        return [
            {"time": time_bucket, "severity": severity, "value": count}
            for (time_bucket, severity), count in buckets.items()
        ]

    @staticmethod
    def _module_for_path(path: str) -> str:
        if "/security/scan-code" in path:
            return "ai_analyst"
        if "/intelligence/" in path:
            return "vulnerability_intelligence"
        if "/prompt-firewall/" in path:
            return "prompt_firewall"
        if "/attack-simulator/" in path or "/simulate-attack" in path:
            return "attack_simulator"
        if "/threats/" in path:
            return "threat_hunter"
        if "/incidents/" in path:
            return "incident_response"
        if "/copilot/" in path:
            return "ai_copilot"
        if "/reports/" in path:
            return "reporting"
        if "/dashboard/" in path:
            return "dashboard"
        if "/auth/" in path:
            return "auth"
        return "system"

    @staticmethod
    def _module_statuses(activity_rows: list[AuditLog]) -> list[dict]:
        modules = [
            ("vulnerability_intelligence", "Vulnerability Intel"),
            ("ai_analyst", "AI Analyst"),
            ("prompt_firewall", "Prompt Firewall"),
            ("attack_simulator", "Attack Simulator"),
            ("threat_hunter", "Threat Hunter"),
            ("incident_response", "Incident Response"),
            ("ai_copilot", "Security Copilot"),
            ("reporting", "Reporting"),
        ]
        tracked_modules = {name for name, _ in modules}
        by_module: dict[str, AuditLog] = {}
        for item in activity_rows:
            module = SecurityDashboard._module_for_path(item.request_path)
            if module in tracked_modules and module not in by_module:
                by_module[module] = item

        status_rows = []
        now = datetime.utcnow()
        for module, label in modules:
            item = by_module.get(module)
            if not item:
                status_rows.append(
                    {
                        "module": module,
                        "label": label,
                        "state": "idle",
                        "last_seen_at": None,
                        "last_action": None,
                        "last_status_code": None,
                    }
                )
                continue

            age_minutes = (now - item.created_at).total_seconds() / 60
            if item.status_code >= 500:
                state = "error"
            elif item.status_code >= 400 or age_minutes > 15:
                state = "warning"
            else:
                state = "healthy"

            status_rows.append(
                {
                    "module": module,
                    "label": label,
                    "state": state,
                    "last_seen_at": item.created_at.isoformat(),
                    "last_action": item.action,
                    "last_status_code": item.status_code,
                }
            )

        return status_rows

    @staticmethod
    async def build_overview(db: Session) -> dict:
        total_scans = db.query(func.count(VulnerabilityScan.id)).scalar() or 0
        avg_risk = db.query(func.avg(VulnerabilityScan.risk_score)).scalar() or 0
        total_threats = db.query(func.count(ThreatEvent.id)).scalar() or 0
        high_scans = db.query(func.count(VulnerabilityScan.id)).filter(VulnerabilityScan.severity.in_(["high", "critical"])).scalar() or 0

        recent_threats = (
            db.query(ThreatEvent)
            .order_by(ThreatEvent.created_at.desc())
            .limit(20)
            .all()
        )
        recent_scans = (
            db.query(VulnerabilityScan)
            .order_by(VulnerabilityScan.created_at.desc())
            .limit(8)
            .all()
        )
        recent_activity = (
            db.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(40)
            .all()
        )
        attack_events = []
        for threat in recent_threats:
            metadata = threat.event_metadata or {}
            if metadata.get("attack"):
                attack_events.append(metadata)

        # Release the DB connection before any awaited enrichment work runs.
        db.close()

        unique_recent_ips = []
        seen_ips = set()
        for threat in recent_threats:
            if threat.source_ip not in seen_ips and threat.source_ip:
                seen_ips.add(threat.source_ip)
                unique_recent_ips.append(threat.source_ip)
        unique_recent_ips = unique_recent_ips[:5]

        intel_profiles = []
        if unique_recent_ips:
            intel_profiles = await asyncio.gather(
                *(ThreatIntelligence.enrich_ip(source_ip) for source_ip in unique_recent_ips)
            )

        severity_distribution = Counter([t.severity for t in recent_threats])
        attack_timeline = Counter([t.created_at.strftime("%H:00") for t in recent_threats])
        heatmap = SecurityDashboard._heatmap(recent_threats)
        activity_timeline = Counter([SecurityDashboard._module_for_path(item.request_path) for item in recent_activity])
        module_statuses = SecurityDashboard._module_statuses(recent_activity)

        active_scans = sum(1 for scan in recent_scans if scan.created_at >= datetime.utcnow() - timedelta(hours=24))
        intel_penalty = sum(profile["threat_reputation_score"] for profile in intel_profiles) // max(1, len(intel_profiles)) if intel_profiles else 0
        risk_score = max(0, 100 - int(float(avg_risk) * 0.85) - min(25, total_threats // 4) - min(20, intel_penalty // 8))
        security_score = max(0, risk_score)
        total_attacks_blocked = sum(1 for item in attack_events if str(item.get("status", "")).lower() == "blocked")
        critical_alerts = sum(1 for threat in recent_threats if str(threat.severity).lower() == "critical")
        active_threats = sum(1 for threat in recent_threats if str(threat.severity).lower() in {"high", "critical"})
        ai_risk_score = round(
            sum(int(item.get("risk_score", 0)) for item in attack_events) / len(attack_events),
            2,
        ) if attack_events else round(float(risk_score), 2)
        firewall_status = "Enabled" if security_score >= 60 else "Attention Required"
        ai_threat_level = "Critical" if security_score < 35 else "High" if security_score < 55 else "Medium" if security_score < 75 else "Low"
        system_integrity = max(0, 100 - (critical_alerts * 8) - (active_threats * 2) - high_scans)
        vulnerabilities_detected = high_scans + total_attacks_blocked

        fallback = {
            "recommendations": [
                "Prioritize remediation of high and critical findings.",
                "Investigate repeated failed logins and normalize suspicious IP reputation spikes.",
                "Increase prompt firewall enforcement on risky AI inputs.",
            ]
        }

        ai_result = await ai_provider.complete_json(
            system_prompt="You are a SOC dashboard analyst producing short enterprise remediation recommendations.",
            user_prompt=(
                f"Security score: {security_score}\n"
                f"Total scans: {total_scans}\n"
                f"Average risk: {avg_risk}\n"
                f"Total threats: {total_threats}\n"
                f"Recent severity counts: {dict(severity_distribution)}\n"
            ),
            fallback=fallback,
        )

        return {
            "security_score": security_score,
            "total_scans": total_scans,
            "avg_risk": round(float(avg_risk), 2),
            "total_threats": total_threats,
            "high_scans": high_scans,
            "active_scans": active_scans,
            "severity_distribution": [{"severity": s, "count": c} for s, c in severity_distribution.items()],
            "attack_timeline": [{"bucket": bucket, "count": count} for bucket, count in attack_timeline.items()],
            "risk_heatmap": heatmap,
            "activity_timeline": [{"module": module, "count": count} for module, count in activity_timeline.items()],
            "module_statuses": module_statuses,
            "recent_activity": [
                {
                    "id": item.id,
                    "module": SecurityDashboard._module_for_path(item.request_path),
                    "action": item.action,
                    "request_path": item.request_path,
                    "status_code": item.status_code,
                    "ip_address": item.ip_address,
                    "role": item.role,
                    "created_at": item.created_at.isoformat(),
                }
                for item in recent_activity
            ],
            "recent_threats": [
                {
                    "id": t.id,
                    "event_type": t.event_type,
                    "source_ip": t.source_ip,
                    "severity": t.severity,
                    "confidence": t.confidence,
                    "description": t.description,
                    "created_at": t.created_at.isoformat(),
                }
                for t in recent_threats
            ],
            "threat_intel": intel_profiles,
            "threat_reputation_avg": round(sum(profile["threat_reputation_score"] for profile in intel_profiles) / len(intel_profiles), 2) if intel_profiles else 0,
            "total_attacks_blocked": total_attacks_blocked,
            "active_threats": active_threats,
            "ai_risk_score": ai_risk_score,
            "critical_alerts": critical_alerts,
            "firewall_status": firewall_status,
            "ai_threat_level": ai_threat_level,
            "system_integrity": system_integrity,
            "vulnerabilities_detected": vulnerabilities_detected,
            "ai_recommendations": ai_result.get("recommendations", fallback["recommendations"]),
            "scan_status": {
                "healthy": security_score >= 70,
                "message": "Monitoring active" if security_score >= 70 else "Immediate attention required",
            },
        }