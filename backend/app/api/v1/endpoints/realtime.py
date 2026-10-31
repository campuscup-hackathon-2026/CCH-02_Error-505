from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.models.user import User
from app.services.realtime.manager import live_capture

router = APIRouter()

class CaptureRequest(BaseModel):
    interface: str

@router.get("/interfaces")
def interfaces(_: User = Depends(get_current_user)):
    return live_capture.interfaces()

@router.get("/overview")
def overview(_: User = Depends(get_current_user)):
    return live_capture.overview()

@router.post("/start")
async def start(payload: CaptureRequest, _: User = Depends(get_current_user)):
    return await live_capture.start(payload.interface)

@router.post("/pause")
async def pause(_: User = Depends(get_current_user)):
    return await live_capture.pause()

@router.post("/stop")
async def stop(_: User = Depends(get_current_user)):
    return await live_capture.stop()

@router.websocket("/ws")
async def websocket(websocket: WebSocket):
    await live_capture.ws.connect(websocket)
    try:
        await websocket.send_json({"type": "traffic_update", "payload": live_capture.overview()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        live_capture.ws.disconnect(websocket)