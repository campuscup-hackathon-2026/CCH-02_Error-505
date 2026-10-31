from app.services.ai_provider import ai_provider


class IncidentResponse:
    @staticmethod
    async def generate_plan(threat_type: str, severity: str, context: str) -> dict:
        base_recommendations = [
            "Enforce MFA for all privileged and developer accounts.",
            "Rotate all exposed API keys and secrets immediately.",
            "Block suspicious source IP ranges at WAF and firewall level.",
            "Apply latest security patches for affected services.",
            "Trigger mandatory password reset for impacted users.",
        ]

        if threat_type.lower() in {"ddos", "ddos_like_pattern"}:
            base_recommendations.insert(0, "Enable DDoS mitigation and autoscaling policies on edge services.")
        if threat_type.lower() in {"brute_force", "suspicious_login"}:
            base_recommendations.insert(0, "Enable adaptive lockout and anomaly-based login challenges.")

        attack_summary = (
            f"{threat_type} activity is being treated as {severity} severity with focus on containment, evidence preservation, and service hardening."
        )
        containment_steps = [
            "Isolate impacted assets and preserve logs.",
            "Validate scope and identify lateral movement.",
            "Apply temporary network controls and block IOCs.",
        ]
        recovery_steps = [
            "Restore services from known-good baselines.",
            "Monitor for recurrence and abnormal authentication patterns.",
            "Document lessons learned and update detections.",
        ]

        fallback = {
            "explanation": (
                f"Generated {len(base_recommendations)} remediation steps for {threat_type} "
                f"with {severity} severity based on provided incident context."
            ),
            "attack_summary": attack_summary,
        }

        ai_result = await ai_provider.complete_json(
            system_prompt="You are an incident response lead writing precise SOC remediation plans.",
            user_prompt=(
                f"Threat type: {threat_type}\nSeverity: {severity}\nContext: {context}\n"
                f"Base recommendations: {base_recommendations}"
            ),
            fallback=fallback,
        )

        return {
            "threat_type": threat_type,
            "severity": severity,
            "recommendations": base_recommendations,
            "containment_steps": containment_steps,
            "recovery_steps": recovery_steps,
            "attack_summary": ai_result.get("attack_summary", attack_summary),
            "ai_explanation": ai_result.get("explanation", fallback["explanation"]),
        }
