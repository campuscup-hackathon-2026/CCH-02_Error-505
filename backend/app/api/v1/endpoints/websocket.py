from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.websocket_manager import ws_manager
from app.services.unidirectional.engine import traffic_engine


router = APIRouter()


@router.websocket("/alerts")
async def alerts_socket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)


@router.websocket("/unidirectional")
async def unidirectional_socket(websocket: WebSocket):
    await traffic_engine.ws.connect(websocket)
    try:
        await websocket.send_json({"channel": "unidirectional_update", "payload": traffic_engine.overview()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        traffic_engine.ws.disconnect(websocket)