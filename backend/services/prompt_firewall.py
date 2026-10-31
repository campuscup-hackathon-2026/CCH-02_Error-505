import re
import json

from app.services.ai_provider import ai_provider


class PromptFirewall:
    injection_patterns = [
        r"ignore previous instructions",
        r"disregard (?:all )?(?:previous|prior|system|safety|security) (?:instructions|rules|guidelines|policies)",
        r"new instructions?:",
        r"stop everything",
        r"override (all|system) rules",
        r"you are now",
        r"disregard safety",
        r"disregard .*safety",
        r"jailbreak",
        r"reveal system prompt",
        r"developer mode",
        r"i am (?:the )?(?:administrator|admin|root|system)",
        r"act as (?:root|admin|system)",
        r"bypass (?:safety|filters|guardrails)",
    ]
    leakage_patterns = [r"api key", r"password", r"token", r"private key", r"secret", r"ssn", r"credit card", r"jwt"]
    unsafe_patterns = [r"create malware", r"bypass authentication", r"ddos", r"exploit", r"phish", r"credential dump"]

    @staticmethod
    def _display_text(value, fallback: str) -> str:
        if isinstance(value, str) and value.strip():
            return value
        if isinstance(value, dict):
            for key in ("explanation", "decision_reason", "summary", "result"):
                nested = value.get(key)
                if isinstance(nested, str) and nested.strip():
                    return nested
            return json.dumps(value, ensure_ascii=False)
        if isinstance(value, list):
            return "; ".join(str(item) for item in value) or fallback
        if value is not None:
            return str(value)
        return fallback

    @staticmethod
    def _bounded_int(value, fallback: int, upper_bound: int | None = None) -> int:
        try:
            number = int(float(value))
        except (TypeError, ValueError):
            number = fallback
        if upper_bound is not None:
            number = min(number, upper_bound)
        return max(0, min(100, number))

    @staticmethod
    async def analyze(prompt: str) -> dict:
        lowered = prompt.lower()
        risks = []
        score_penalty = 0
        trust_penalty = 0

        def check_patterns(patterns: list[str], category: str, penalty: int, trust_cost: int):
            nonlocal score_penalty, trust_penalty
            for pattern in patterns:
                if re.search(pattern, lowered):
                    score_penalty += penalty
                    trust_penalty += trust_cost
                    risks.append({"category": category, "pattern": pattern, "severity": "high" if penalty >= 20 else "medium"})

        check_patterns(PromptFirewall.injection_patterns, "prompt_injection", 25, 30)
        check_patterns(PromptFirewall.leakage_patterns, "sensitive_data_leakage", 15, 15)
        check_patterns(PromptFirewall.unsafe_patterns, "unsafe_instruction", 20, 20)

        jailbreak_score = min(100, sum(15 for item in risks if item["category"] == "prompt_injection"))
        leakage_score = min(100, sum(12 for item in risks if item["category"] == "sensitive_data_leakage"))
        trust_score = max(0, 100 - trust_penalty - jailbreak_score // 2 - leakage_score // 3)

        safety_score = max(0, 100 - score_penalty)
        risk_level = "critical" if safety_score <= 20 else "high" if safety_score <= 40 else "medium" if safety_score <= 70 else "low"
        blocked = risk_level in {"critical", "high"} or jailbreak_score >= 20 or leakage_score >= 20

        fallback = {
            "explanation": (
                f"Prompt evaluated with safety score {safety_score}/100. "
                f"Detected {len(risks)} risky patterns and overall risk level is {risk_level}."
            ),
            "trust_score": trust_score,
            "blocked": blocked,
            "decision_reason": "Prompt injection or sensitive data leakage detected" if blocked else "Prompt accepted with monitoring",
        }

        ai_result = await ai_provider.complete_json(
            system_prompt="You are a prompt security firewall assistant.",
            user_prompt=f"Prompt:\n{prompt}\nRisks:{risks}\nSafety score:{safety_score}\nRisk level:{risk_level}",
            fallback=fallback,
        )

        provider = ai_result.get("provider", "fallback")
        if provider == "fallback":
            provider = "local_rules"

        ai_blocked = ai_result.get("blocked", blocked)
        final_blocked = blocked or ai_blocked is True
        decision_reason = PromptFirewall._display_text(
            ai_result.get("decision_reason"),
            fallback["decision_reason"],
        )
        if blocked:
            decision_reason = fallback["decision_reason"]

        return {
            "safety_score": safety_score,
            "trust_score": PromptFirewall._bounded_int(ai_result.get("trust_score"), trust_score, trust_score),
            "jailbreak_score": jailbreak_score,
            "leakage_score": leakage_score,
            "risk_level": risk_level,
            "risks": risks,
            "blocked": final_blocked,
            "explanation": PromptFirewall._display_text(ai_result.get("explanation"), fallback["explanation"]),
            "decision_reason": decision_reason,
            "provider": provider,
        }
