from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.security import PhishingAnalysisRequest
from app.services.phishing_detector import analyze_phishing
from app.services.websocket_manager import ws_manager


router = APIRouter()


@router.post("/analyze")
async def analyze(payload: PhishingAnalysisRequest, _: User = Depends(get_current_user)):
    result = await analyze_phishing(payload.content)
    if result["severity"] in {"HIGH", "CRITICAL"}:
        await ws_manager.broadcast_json({
            "channel": "notification",
            "payload": {
                "title": "⚠ Phishing Attempt Blocked",
                "message": result["result"],
                "tone": result["severity"].lower(),
            },
        })
    return result