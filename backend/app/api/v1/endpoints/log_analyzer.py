from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.security import LogAnalysisRequest
from app.services.log_analyzer import analyze_logs
from app.services.websocket_manager import ws_manager


router = APIRouter()


@router.post("/analyze")
async def analyze(payload: LogAnalysisRequest, _: User = Depends(get_current_user)):
    result = await analyze_logs(payload.logs)
    if result["severity"] in {"HIGH", "CRITICAL"}:
        await ws_manager.broadcast_json({
            "channel": "notification",
            "payload": {
                "title": "⚠ Suspicious Login Detected",
                "message": result["result"],
                "tone": result["severity"].lower(),
            },
        })
    return result