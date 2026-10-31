import asyncio
import tempfile
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.api.deps import get_current_user
from app.models.user import User
from app.services.unidirectional.engine import SCENARIOS, traffic_engine
from app.schemas.unidirectional import NormalizedFlow, ReplayRequest
from app.core.config import settings
from app.services.unidirectional.pcap import extract_flows
from app.services.realtime.manager import live_capture


router = APIRouter()


class DemoRequest(BaseModel):
    scenario: str = Field("normal")
    speed: float = Field(1.0, ge=0.5, le=5.0)


@router.get("/overview")
def overview(_: User = Depends(get_current_user)):
    return traffic_engine.overview()

@router.get("/status")
def status(_: User = Depends(get_current_user)):
    return traffic_engine.overview()

@router.get("/metrics")
def metrics(_: User = Depends(get_current_user)):
    return {"traffic": traffic_engine.overview()["traffic"], "pipeline": traffic_engine.overview()["pipeline"]}

@router.get("/flows")
def flows(_: User = Depends(get_current_user)):
    return {"items": traffic_engine.overview()["flows"], "metadata_only": True}

@router.get("/alerts")
def alerts(_: User = Depends(get_current_user)):
    return {"items": traffic_engine.overview()["alerts"]}

@router.get("/alerts/{alert_id}")
def alert(alert_id: str, _: User = Depends(get_current_user)):
    for item in traffic_engine.alerts:
        if item["alert_id"] == alert_id: return item
    raise HTTPException(status_code=404, detail="Alert not found")

@router.get("/threats")
def threats(_: User = Depends(get_current_user)):
    return {"items": traffic_engine.overview()["alerts"]}

@router.get("/timeline")
def timeline(_: User = Depends(get_current_user)):
    return {"items": traffic_engine.overview()["timeline"]}

@router.get("/top-talkers")
def top_talkers(_: User = Depends(get_current_user)):
    flows = traffic_engine.overview()["flows"]
    ranked = sorted(flows, key=lambda item: item["byte_count"], reverse=True)[:10]
    return {"items": [{"source": item["source_ip"], "destination": item["destination_ip"], "bytes": item["byte_count"]} for item in ranked]}

class LiveFeedRequest(BaseModel):
    interface: str

class FlowBatch(BaseModel):
    flows: list[NormalizedFlow] = Field(min_length=1, max_length=1000)

@router.get("/live/status")
def live_status(_: User = Depends(get_current_user)):
    return live_capture.overview()

@router.get("/live/interfaces")
def live_interfaces(_: User = Depends(get_current_user)):
    return live_capture.interfaces()

@router.post("/live/start")
async def live_start(payload: LiveFeedRequest, _: User = Depends(get_current_user)):
    """Start observation on a local TAP/data-diode ingest NIC only."""
    return await live_capture.start(payload.interface)

@router.post("/live/stop")
async def live_stop(_: User = Depends(get_current_user)):
    return await live_capture.stop()

@router.post("/analyze-flow")
async def analyze_flow(payload: NormalizedFlow, _: User = Depends(get_current_user)):
    return await traffic_engine.analyse(payload.model_dump(mode="json"))

@router.post("/ingest/flows")
async def ingest_flow_records(payload: FlowBatch, _: User = Depends(get_current_user)):
    """NetFlow/IPFIX/sFlow adapters can POST their normalized records here; no reverse connection is made."""
    accepted = sum(await traffic_engine.submit(flow.model_dump(mode="json"), "flow_record") for flow in payload.flows)
    if accepted != len(payload.flows):
        raise HTTPException(status_code=503, detail="Passive analysis queue is full; retry the unaccepted records")
    return {"accepted": accepted, "queue_depth": traffic_engine.queue.qsize(), "read_only": True}

@router.post("/analyze-pcap")
async def analyze_pcap(file: UploadFile = File(...), _: User = Depends(get_current_user)):
    """Read a capture file into metadata-only flows; no packet replay or transmission."""
    if not file.filename or not file.filename.lower().endswith((".pcap", ".pcapng", ".cap")):
        raise HTTPException(status_code=415, detail="Upload a .pcap, .pcapng, or .cap file")
    content = await file.read()
    if len(content) > settings.max_pcap_size_bytes:
        raise HTTPException(status_code=413, detail="PCAP exceeds configured size limit")
    with tempfile.NamedTemporaryFile(suffix=Path(file.filename).suffix, delete=False) as temporary:
        temporary.write(content); path = temporary.name
    try:
        flows = await asyncio.to_thread(extract_flows, path)
        outcomes = [await traffic_engine.analyse(flow) for flow in flows]
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"PCAP parsing failed: {exc}") from exc
    finally:
        Path(path).unlink(missing_ok=True)
    return {"file_name": file.filename, "flows_analyzed": len(outcomes), "alerts_generated": sum(item["alert"] is not None for item in outcomes), "metadata_only": True, "flows": [item["flow"] for item in outcomes[:200]]}

@router.post("/replay/start")
async def replay_start(payload: ReplayRequest, _: User = Depends(get_current_user)):
    try: return await traffic_engine.start_replay(payload.scenarios, payload.speed)
    except ValueError as exc: raise HTTPException(status_code=409, detail=str(exc)) from exc

@router.post("/replay/stop")
async def replay_stop(_: User = Depends(get_current_user)):
    return await traffic_engine.stop()

@router.post("/dataset/generate")
def dataset_generate(_: User = Depends(get_current_user)):
    return {"flows": [traffic_engine.synthetic_flow(name) for name in SCENARIOS], "label": "synthetic-demo", "warning": "Synthetic traffic is for functional demonstrations only; it is not a trained-model accuracy dataset."}

@router.post("/benchmark")
async def benchmark(flows: int = 100, _: User = Depends(get_current_user)):
    if not 1 <= flows <= 1000: raise HTTPException(status_code=422, detail="flows must be between 1 and 1000")
    return await traffic_engine.benchmark(flows)

@router.get("/benchmark")
def benchmark_results(_: User = Depends(get_current_user)):
    return {"items": list(traffic_engine.benchmarks)}


@router.get("/scenarios")
def scenarios(_: User = Depends(get_current_user)):
    return {"scenarios": SCENARIOS, "speeds": [0.5, 1, 2, 5]}


@router.post("/demo/start")
async def start_demo(payload: DemoRequest, _: User = Depends(get_current_user)):
    try:
        return await traffic_engine.start(payload.scenario, payload.speed)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/demo/pause")
async def pause_demo(_: User = Depends(get_current_user)):
    return await traffic_engine.pause()


@router.post("/demo/stop")
async def stop_demo(_: User = Depends(get_current_user)):
    return await traffic_engine.stop()


@router.post("/demo/reset")
def reset_demo(_: User = Depends(get_current_user)):
    return traffic_engine.reset()


@router.websocket("/ws")
async def traffic_socket(websocket: WebSocket):
    await traffic_engine.ws.connect(websocket)
    try:
        await websocket.send_json({"channel": "unidirectional_update", "payload": traffic_engine.overview()})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        traffic_engine.ws.disconnect(websocket)