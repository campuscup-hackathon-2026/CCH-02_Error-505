from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.security import ThreatIntelRequest, VulnerabilityAnalysisRequest
from app.services.threat_intelligence import ThreatIntelligence
from app.services.vulnerability_intelligence import VulnerabilityIntelligence


router = APIRouter()


@router.post("/analyze")
async def analyze_vulnerability(
    payload: VulnerabilityAnalysisRequest,
    _: User = Depends(get_current_user),
):
    return await VulnerabilityIntelligence.analyze_code(payload.filename, payload.content)


@router.post("/lookup")
async def lookup_threat_intel(
    payload: ThreatIntelRequest,
    _: User = Depends(get_current_user),
):
    return await ThreatIntelligence.analyze_indicator(payload.indicator, payload.kind, payload.user_agent)