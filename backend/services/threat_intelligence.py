from __future__ import annotations

import asyncio
import ipaddress
import re
import time
from dataclasses import dataclass
import logging

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class ThreatIntelResult:
    ip: str
    malicious: bool
    threat_reputation_score: int
    indicators: list[str]
    asn: str
    country: str
    is_tor: bool
    is_proxy: bool
    is_vpn: bool
    sources: dict

    def as_dict(self) -> dict:
        return {
            "ip": self.ip,
            "malicious": self.malicious,
            "threat_reputation_score": self.threat_reputation_score,
            "indicators": self.indicators,
            "asn": self.asn,
            "country": self.country,
            "is_tor": self.is_tor,
            "is_proxy": self.is_proxy,
            "is_vpn": self.is_vpn,
            "sources": self.sources,
        }


class ThreatIntelligence:
    _ip_cache: dict[str, tuple[float, dict]] = {}
    _indicator_cache: dict[str, tuple[float, dict]] = {}
    _ip_cache_ttl_seconds = 300

    @staticmethod
    def _threatfox_endpoint() -> str | None:
        value = settings.threatfox_api_key
        if not value:
            return None
        if value.startswith("http://") or value.startswith("https://"):
            return value
        return "https://threatfox-api.abuse.ch/api/v1/"

    @staticmethod
    def _parse_ip(ip: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
        try:
            return ipaddress.ip_address(ip)
        except ValueError:
            return None

    @staticmethod
    def _can_use_external_reputation(ip: str) -> bool:
        parsed = ThreatIntelligence._parse_ip(ip)
        return bool(parsed and parsed.is_global)

    @staticmethod
    def _provider_for_sources(sources: dict, upstream_configured: bool) -> str:
        upstream_sources = {name: payload for name, payload in sources.items() if name != "local" and payload}
        if upstream_sources:
            return "enriched"
        if sources.get("local"):
            return "local"
        if upstream_configured:
            return "no_upstream_hits"
        return "local"

    @staticmethod
    def _basic_ip_profile(ip: str, user_agent: str | None = None) -> ThreatIntelResult:
        indicators: list[str] = []
        sources: dict[str, dict] = {}
        score = 10

        try:
            parsed = ipaddress.ip_address(ip)
            if parsed.is_private or parsed.is_loopback or parsed.is_reserved:
                score += 25
                indicators.append("internal_or_reserved_ip")
        except ValueError:
            score += 15
            indicators.append("invalid_ip_format")

        fingerprint = f"{ip} {user_agent or ''}".lower()
        is_tor = bool(re.search(r"\btor\b", fingerprint))
        is_proxy = bool(re.search(r"\bproxy\b", fingerprint))
        is_vpn = bool(re.search(r"\bvpn\b|wireguard|openvpn|l2tp", fingerprint))

        if is_tor:
            score += 30
            indicators.append("tor_indicator")
        if is_proxy:
            score += 20
            indicators.append("proxy_indicator")
        if is_vpn:
            score += 15
            indicators.append("vpn_indicator")

        asn = "AS-UNKNOWN"
        country = "Unknown"
        malicious = score >= 50

        return ThreatIntelResult(
            ip=ip,
            malicious=malicious,
            threat_reputation_score=min(100, score),
            indicators=indicators,
            asn=asn,
            country=country,
            is_tor=is_tor,
            is_proxy=is_proxy,
            is_vpn=is_vpn,
            sources=sources,
        )

    @staticmethod
    async def enrich_ip(ip: str, user_agent: str | None = None) -> dict:
        cache_key = f"{ip}|{user_agent or ''}"
        cached = ThreatIntelligence._ip_cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < ThreatIntelligence._ip_cache_ttl_seconds:
            cached[1].setdefault(
                "provider",
                ThreatIntelligence._provider_for_sources(
                    cached[1].get("sources", {}),
                    bool(settings.virustotal_api_key or settings.abuseipdb_api_key or settings.shodan_api_key or ThreatIntelligence._threatfox_endpoint()),
                ),
            )
            return cached[1]

        result = ThreatIntelligence._basic_ip_profile(ip, user_agent=user_agent)
        sources = result.sources
        threatfox_endpoint = ThreatIntelligence._threatfox_endpoint()
        upstream_configured = bool(settings.virustotal_api_key or settings.abuseipdb_api_key or settings.shodan_api_key or threatfox_endpoint)

        if not ThreatIntelligence._can_use_external_reputation(ip):
            result.sources["local"] = {"reason": "external_reputation_skipped_for_non_global_ip"}
            payload = result.as_dict()
            payload["provider"] = "local"
            ThreatIntelligence._ip_cache[cache_key] = (now, payload)
            return payload

        async def enrich_sources() -> None:
            timeout = httpx.Timeout(2.0, connect=1.0, read=2.0, write=2.0, pool=1.0)
            async with httpx.AsyncClient(timeout=timeout) as client:
                if settings.virustotal_api_key:
                    try:
                        response = await client.get(
                            f"https://www.virustotal.com/api/v3/ip_addresses/{ip}",
                            headers={"x-apikey": settings.virustotal_api_key},
                        )
                        if response.status_code == 200:
                            payload = response.json().get("data", {}).get("attributes", {})
                            sources["virustotal"] = payload
                            result.threat_reputation_score = min(100, max(result.threat_reputation_score, int(payload.get("last_analysis_stats", {}).get("malicious", 0) * 20)))
                            result.malicious = result.malicious or result.threat_reputation_score >= 50
                    except httpx.TimeoutException:
                        logger.info("VirusTotal lookup timed out for %s", ip)
                    except Exception as exc:
                        logger.warning("VirusTotal lookup failed for %s: %s", ip, exc)

                if threatfox_endpoint:
                    try:
                        response = await client.post(
                            threatfox_endpoint,
                            json={"query": "search_ioc", "search_term": ip},
                            headers={"Content-Type": "application/json"},
                        )
                        if response.status_code == 200:
                            payload = response.json()
                            sources["threatfox"] = payload
                            if isinstance(payload, dict):
                                matches = payload.get("data", []) if isinstance(payload.get("data"), list) else payload.get("data") or []
                                if matches:
                                    result.threat_reputation_score = min(100, max(result.threat_reputation_score, 60))
                                    result.malicious = True
                                    result.indicators.append("threatfox_ioc_match")
                    except httpx.TimeoutException:
                        logger.info("ThreatFox lookup timed out for %s", ip)
                    except Exception as exc:
                        logger.warning("ThreatFox lookup failed for %s: %s", ip, exc)

                if settings.abuseipdb_api_key:
                    try:
                        response = await client.get(
                            "https://api.abuseipdb.com/api/v2/check",
                            params={"ipAddress": ip, "maxAgeInDays": 90, "verbose": "true"},
                            headers={"Key": settings.abuseipdb_api_key, "Accept": "application/json"},
                        )
                        if response.status_code == 200:
                            payload = response.json().get("data", {})
                            sources["abuseipdb"] = payload
                            abuse_score = int(float(payload.get("abuseConfidenceScore", 0)))
                            result.threat_reputation_score = max(result.threat_reputation_score, abuse_score)
                            result.malicious = result.malicious or abuse_score >= 50
                    except httpx.TimeoutException:
                        logger.info("AbuseIPDB lookup timed out for %s", ip)
                    except Exception as exc:
                        logger.warning("AbuseIPDB lookup failed for %s: %s", ip, exc)

                if settings.shodan_api_key:
                    try:
                        response = await client.get(
                            f"https://api.shodan.io/shodan/host/{ip}",
                            params={"key": settings.shodan_api_key},
                        )
                        if response.status_code == 200:
                            payload = response.json()
                            sources["shodan"] = payload
                            result.asn = payload.get("asn", result.asn)
                            result.country = payload.get("country_name", result.country)
                            result.threat_reputation_score = min(100, result.threat_reputation_score + 10)
                    except httpx.TimeoutException:
                        logger.info("Shodan lookup timed out for %s", ip)
                    except Exception as exc:
                        logger.warning("Shodan lookup failed for %s: %s", ip, exc)

        try:
            await asyncio.wait_for(enrich_sources(), timeout=5.0)
        except TimeoutError:
            logger.warning("Threat intel enrichment timed out for %s; returning fallback profile", ip)

        payload = result.as_dict()
        payload["provider"] = ThreatIntelligence._provider_for_sources(sources, upstream_configured)
        if payload["provider"] == "no_upstream_hits":
            payload["sources"]["local"] = {"reason": "Configured upstream sources returned no hit for this IP."}
        ThreatIntelligence._ip_cache[cache_key] = (time.monotonic(), payload)
        return payload

    @staticmethod
    async def analyze_indicator(indicator: str, kind: str = "ip", user_agent: str | None = None) -> dict:
        if kind == "ip":
            return await ThreatIntelligence.enrich_ip(indicator, user_agent=user_agent)

        cache_key = f"{kind}|{indicator}|{user_agent or ''}"
        cached = ThreatIntelligence._indicator_cache.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < ThreatIntelligence._ip_cache_ttl_seconds:
            return cached[1]

        score = 20
        indicators = [f"{kind}_observed"]
        if kind == "domain" and re.search(r"(malware|phish|dump|steal|login|secure|verify|update)", indicator, re.IGNORECASE):
            score += 40
            indicators.append("suspicious_domain_keyword")

        sources = {}
        threatfox_endpoint = ThreatIntelligence._threatfox_endpoint()
        async with httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=2.0, read=5.0, write=3.0, pool=2.0)) as client:
            if kind == "domain" and settings.virustotal_api_key:
                try:
                    response = await client.get(
                        f"https://www.virustotal.com/api/v3/domains/{indicator}",
                        headers={"x-apikey": settings.virustotal_api_key},
                    )
                    if response.status_code == 200:
                        payload = response.json().get("data", {}).get("attributes", {})
                        sources["virustotal"] = payload
                        stats = payload.get("last_analysis_stats", {}) if isinstance(payload, dict) else {}
                        malicious_count = int(stats.get("malicious", 0) or 0)
                        suspicious_count = int(stats.get("suspicious", 0) or 0)
                        score = max(score, min(100, malicious_count * 25 + suspicious_count * 10))
                        if malicious_count or suspicious_count:
                            indicators.append("virustotal_domain_detection")
                except httpx.TimeoutException:
                    logger.info("VirusTotal domain lookup timed out for %s", indicator)
                except Exception as exc:
                    logger.warning("VirusTotal domain lookup failed for %s: %s", indicator, exc)

            if threatfox_endpoint:
                try:
                    response = await client.post(
                        threatfox_endpoint,
                        json={"query": "search_ioc", "search_term": indicator},
                        headers={"Content-Type": "application/json"},
                    )
                    if response.status_code == 200:
                        payload = response.json()
                        sources["threatfox"] = payload
                        if payload:
                            score = max(score, 65)
                            indicators.append("threatfox_match")
                except Exception:
                    logger.warning("ThreatFox indicator lookup failed for %s", indicator)

        if sources:
            provider = "enriched"
        elif settings.virustotal_api_key or threatfox_endpoint:
            provider = "no_upstream_hits"
            sources["local"] = {"reason": "No configured upstream source returned a hit for this indicator."}
        else:
            provider = "local"
            sources["local"] = {"reason": "No threat intelligence API keys are configured for this indicator type."}

        payload = {
            "indicator": indicator,
            "kind": kind,
            "malicious": score >= 50,
            "threat_reputation_score": min(100, score),
            "indicators": indicators,
            "asn": "AS-UNKNOWN",
            "country": "Unknown",
            "is_tor": False,
            "is_proxy": False,
            "is_vpn": False,
            "sources": sources,
            "provider": provider,
        }
        ThreatIntelligence._indicator_cache[cache_key] = (time.monotonic(), payload)
        return payload
