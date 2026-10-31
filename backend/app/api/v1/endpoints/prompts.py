from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.security import PromptAnalysisRequest
from app.services.prompt_firewall import PromptFirewall


router = APIRouter()


@router.post("/analyze")
async def analyze_prompt(payload: PromptAnalysisRequest, _: User = Depends(get_current_user)):
    return await PromptFirewall.analyze(payload.prompt)