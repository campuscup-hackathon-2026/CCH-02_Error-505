from __future__ import annotations

import re

from app.services.local_ai import summarize_with_ollama


SUSPICIOUS_KEYWORDS = [
    "urgent",
    "verify",
    "password",
    "login",
    "account",
    "suspended",
    "immediately",
    "security alert",
    "gift card",
    "wire transfer",
    "confirm your identity",
]

URL_PATTERNS = [
    r"https?://[\w\-./?%=&]+",
    r"bit\.ly/[\w-]+",
    r"tinyurl\.com/[\w-]+",
    r"xn--[\w-]+",
    r"\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b",
]


def _severity(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _normalize_text(content: str) -> str:
    return re.sub(r"\s+", " ", content.strip().lower())


async def analyze_phishing(content: str) -> dict:
    normalized = _normalize_text(content)
    findings: list[str] = []
    score = 5

    for keyword in SUSPICIOUS_KEYWORDS:
        if keyword in normalized:
            findings.append(f"Keyword match: {keyword}")
            score += 9

    for pattern in URL_PATTERNS:
        matches = re.findall(pattern, content, flags=re.IGNORECASE)
        if matches:
            score += 12
            findings.append(f"Suspicious link pattern: {matches[0]}")

    if re.search(r"password|credential|token|otp|mfa", normalized):
        score += 15
        findings.append("Credential harvesting language detected")

    if re.search(r"act now|within (?:1|24) hour|final warning|immediately", normalized):
        score += 12
        findings.append("Urgency tactic detected")

    if re.search(r"log(?: in)?\b|sign in|verify account|reset your password", normalized):
        score += 12
        findings.append("Fake login lure detected")

    if not findings:
        findings.append("No high-confidence phishing indicators found")

    score = min(99, max(score, 0))
    severity = _severity(score)
    result = "Potential phishing attempt detected" if score >= 40 else "Low phishing likelihood"

    fallback_explanation = (
        f"The content matches {len(findings)} local phishing indicators, including urgency, login lures, and credential harvesting patterns."
    )
    explanation = await summarize_with_ollama(
        "Explain phishing risks in concise defensive language.",
        f"Analyze this message for phishing indicators:\n{content}\nFindings: {findings}",
        fallback_explanation,
    )

    return {
        "risk_score": score,
        "severity": severity,
        "result": result,
        "explanation": explanation,
        "recommended_action": "Do not click links. Verify with the sender through a known channel and report to security.",
        "indicators": findings,
        "phishing_probability": round(score / 100, 2),
        "terminal_logs": [
            "Scanning text for phishing language...",
            "Matching suspicious keywords and fake login links...",
            f"Phishing score computed at {score}/100...",
            "Recommendation generated for user awareness...",
        ],
    }
