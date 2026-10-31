from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.models.user import User
from app.schemas.security import CopilotChatRequest
from app.services.copilot_chat import SecurityCopilot


router = APIRouter()


@router.post("/chat")
async def copilot_chat(payload: CopilotChatRequest, _: User = Depends(get_current_user)):
    history = [item.model_dump() for item in payload.history] if payload.history else None
    return await SecurityCopilot.respond(payload.message, payload.context, history, payload.provider)