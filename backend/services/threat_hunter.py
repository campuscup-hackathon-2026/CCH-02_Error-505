import asyncio
import json
from collections import Counter

from app.services.threat_intelligence import ThreatIntelligence
from app.services.ai_provider import ai_provider


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
            "notable_ips": "notable IPs",
            "proxy_vpn_alerts": "proxy/VPN alerts",
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


class ThreatHunter:
    @staticmethod
    async def analyze_logs(logs: list[dict]) -> dict:
        if not logs:
            return {
                "threat_score": 0,
                "alerts": [],
                "enriched_alerts": [],
                "summary": "No logs supplied for threat hunting.",
                "predicted_next_severity": "low",
                "anomaly_summary": {
                    "top_failed_ips": [],
                    "unusual_user_agents": [],
                    "suspicious_login_sources": [],
                },
            }

        failed_by_ip = Counter()
        user_agent_counter = Counter()
        ip_activity = Counter()
        login_activity = Counter()
        unusual_agents = Counter()

        for log in logs:
            ip = log["source_ip"]
            ip_activity[ip] += 1
            user_agent_counter[log["user_agent"]] += 1
            login_activity[(ip, log["action"].lower())] += 1
            if log["status"].lower() in {"failed", "denied", "invalid"}:
                failed_by_ip[ip] += 1
            if any(keyword in log["user_agent"].lower() for keyword in ["bot", "curl", "python", "headless", "proxy", "vpn", "tor"]):
                unusual_agents[log["user_agent"]] += 1

        alerts = []
        enriched_alerts = []
        enrichment_targets: set[str] = set()

        for ip, failed_count in failed_by_ip.items():
            if failed_count >= 5:
                alert = {
                    "type": "brute_force",
                    "source_ip": ip,
                    "severity": "high",
                    "confidence": min(0.99, 0.5 + failed_count / 20),
                    "description": f"{failed_count} failed authentication attempts detected.",
                }
                alerts.append(alert)
                enriched_alerts.append(alert)
                enrichment_targets.add(ip)

        for (ip, action), count in login_activity.items():
            if action in {"login", "auth", "signin"} and count >= 4:
                alert = {
                    "type": "suspicious_login_activity",
                    "source_ip": ip,
                    "severity": "medium" if count < 8 else "high",
                    "confidence": min(0.98, 0.45 + count / 15),
                    "description": f"Suspicious repeated login activity observed for action '{action}' ({count} events).",
                }
                alerts.append(alert)
                enriched_alerts.append(alert)
                enrichment_targets.add(ip)

        for ip, activity_count in ip_activity.items():
            if activity_count >= 50:
                alert = {
                    "type": "ddos_like_pattern",
                    "source_ip": ip,
                    "severity": "critical",
                    "confidence": min(0.99, 0.6 + activity_count / 200),
                    "description": f"Traffic burst pattern detected with {activity_count} requests.",
                }
                alerts.append(alert)
                enriched_alerts.append(alert)
                enrichment_targets.add(ip)

            if 20 <= activity_count < 50:
                alert = {
                    "type": "unusual_traffic_behavior",
                    "source_ip": ip,
                    "severity": "medium",
                    "confidence": min(0.96, 0.35 + activity_count / 100),
                    "description": f"Traffic burst pattern detected with {activity_count} requests; behavior deviates from baseline.",
                }
                alerts.append(alert)
                enriched_alerts.append(alert)
                enrichment_targets.add(ip)

        for ua, count in user_agent_counter.items():
            if "vpn" in ua.lower() or "proxy" in ua.lower():
                alert = {
                    "type": "vpn_or_proxy_usage",
                    "source_ip": "multiple",
                    "severity": "medium",
                    "confidence": min(0.95, 0.4 + count / 100),
                    "description": f"Potential anonymized traffic detected via user-agent '{ua}'.",
                    "ip_intel": {
                        "ip": "multiple",
                        "malicious": False,
                        "threat_reputation_score": 45,
                        "indicators": ["proxy_or_vpn_user_agent"],
                        "asn": "AS-UNKNOWN",
                        "country": "Unknown",
                        "is_tor": False,
                        "is_proxy": True,
                        "is_vpn": True,
                        "sources": {},
                    },
                }
                alerts.append(alert)
                enriched_alerts.append(alert)

        ip_intel_cache: dict[str, dict] = {}

        if enrichment_targets:
            enrichment_budget = min(6.0, 0.8 + len(enrichment_targets) * 0.6)

            async def enrich_target(ip: str) -> tuple[str, dict | None]:
                try:
                    intel = await asyncio.wait_for(ThreatIntelligence.enrich_ip(ip), timeout=4.0)
                    return ip, intel
                except TimeoutError:
                    return ip, None
                except Exception:
                    return ip, None

            try:
                results = await asyncio.wait_for(
                    asyncio.gather(*(enrich_target(ip) for ip in enrichment_targets)),
                    timeout=enrichment_budget,
                )
                for ip, intel in results:
                    if intel is not None:
                        ip_intel_cache[ip] = intel
            except TimeoutError:
                pass

        for alert in alerts:
            ip = alert.get("source_ip")
            if ip in ip_intel_cache:
                alert["ip_intel"] = ip_intel_cache[ip]
            elif alert.get("type") == "vpn_or_proxy_usage":
                continue
            else:
                alert.setdefault(
                    "ip_intel",
                    {
                        "ip": ip,
                        "malicious": False,
                        "threat_reputation_score": 10,
                        "indicators": ["fallback_profile"],
                        "asn": "AS-UNKNOWN",
                        "country": "Unknown",
                        "is_tor": False,
                        "is_proxy": False,
                        "is_vpn": False,
                        "sources": {},
                    },
                )

        anomaly_summary = {
            "top_failed_ips": [
                {"ip": ip, "failed_attempts": count}
                for ip, count in failed_by_ip.most_common(5)
            ],
            "unusual_user_agents": [
                {"user_agent": ua, "count": count}
                for ua, count in unusual_agents.most_common(5)
            ],
            "suspicious_login_sources": [
                {"ip": ip, "action": action, "count": count}
                for (ip, action), count in login_activity.most_common(10)
                if action in {"login", "auth", "signin"}
            ],
        }

        threat_score = min(100, sum(30 if a["severity"] == "critical" else 20 if a["severity"] == "high" else 10 for a in alerts))

        fallback = {
            "summary": f"Threat hunting completed with {len(alerts)} alerts and threat score {threat_score}/100.",
            "predicted_next_severity": "high" if threat_score >= 55 else "medium" if threat_score >= 25 else "low",
        }

        ai_result = await ai_provider.complete_json(
            system_prompt="You are a SOC threat hunter summarizing network threats.",
            user_prompt=f"Logs count:{len(logs)}\nAlerts:{alerts}\nThreat score:{threat_score}",
            fallback=fallback,
        )

        return {
            "threat_score": threat_score,
            "alerts": alerts,
            "enriched_alerts": enriched_alerts,
            "summary": _display_text(ai_result.get("summary"), fallback["summary"]),
            "predicted_next_severity": _display_text(ai_result.get("predicted_next_severity"), fallback["predicted_next_severity"]),
            "anomaly_summary": anomaly_summary,
        }
