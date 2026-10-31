from datetime import datetime

from pydantic import BaseModel


class PromptAnalysisRequest(BaseModel):
    prompt: str


class LogEntry(BaseModel):
    timestamp: datetime
    source_ip: str
    action: str
    status: str
    user_agent: str


class ThreatHuntRequest(BaseModel):
    logs: list[LogEntry]


class IncidentPlanRequest(BaseModel):
    threat_type: str
    severity: str
    context: str


class CopilotMessage(BaseModel):
    role: str
    content: str


class CopilotChatRequest(BaseModel):
    message: str
    context: dict | None = None
    history: list[CopilotMessage] | None = None
    provider: str | None = None


class VulnerabilityAnalysisRequest(BaseModel):
    filename: str
    content: str


class ThreatIntelRequest(BaseModel):
    indicator: str
    kind: str = "ip"
    user_agent: str | None = None


class PhishingAnalysisRequest(BaseModel):
    content: str


class LogAnalysisRequest(BaseModel):
    logs: str | list[str]


class MalwareAnalysisRequest(BaseModel):
    content: str
    filename: str | None = None
