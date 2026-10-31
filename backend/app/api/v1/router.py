from __future__ import annotations

import os
import tempfile
import asyncio
import json
from pathlib import Path

from fastapi import APIRouter, Body, Depends, File, HTTPException, Request, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal, get_db
from app.models.incident_plan import IncidentPlan
from app.models.report import Report
from app.models.threat_event import ThreatEvent
from app.models.user import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse
from app.schemas.security import (
    CopilotChatRequest,
    IncidentPlanRequest,
    LogAnalysisRequest,
    MalwareAnalysisRequest,
    PhishingAnalysisRequest,
    PromptAnalysisRequest,
    ThreatHuntRequest,
    ThreatIntelRequest,
    VulnerabilityAnalysisRequest,
)
from app.services.attack_simulator import build_ai_analysis, build_terminal_logs, generate_attack_event
from app.services.code_scanner import CodeScanner
from app.services.copilot_chat import SecurityCopilot
from app.services.incident_response import IncidentResponse
from app.services.lockdown_controller import (
    get_security_state,
    initiate_lockdown,
    release_lockdown,
    set_security_mode,
)
from app.services.log_analyzer import analyze_logs
from app.services.malware_analyzer import analyze_malware
from app.services.phishing_detector import analyze_phishing
from app.services.prompt_firewall import PromptFirewall
from app.services.recommendation_engine import build_recommendations
from app.services.report_service import ReportService
from app.services.security_dashboard import SecurityDashboard
from app.services.threat_hunter import ThreatHunter
from app.services.threat_intelligence import ThreatIntelligence
from app.services.threat_predictor import predict_threat
from app.services.unidirectional.engine import SCENARIOS, traffic_engine
from app.services.unidirectional.pcap import extract_flows
from app.services.realtime.manager import live_capture
from app.services.vulnerability_intelligence import VulnerabilityIntelligence
from app.services.websocket_manager import ws_manager
from app.utils.security import create_access_token, hash_password, verify_password

api_router = APIRouter()
MAX_TEXT_SIZE = 2_000_000


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    header = request.headers.get("authorization", "")
    if not header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    user = _user_from_token(header[7:].strip(), db)
    if user is None:
        raise HTTPException(status_code=401, detail="Invalid, expired, or unavailable account")
    return user


def _user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub", ""))
    except (JWTError, ValueError, TypeError):
        return None
    return db.query(User).filter(User.id == user_id, User.is_active.is_(True)).first()


@api_router.get("/health")
def api_health():
    return {"status": "healthy", "api": "v1"}


@api_router.post("/auth/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    if len(payload.password) < 10:
        raise HTTPException(status_code=422, detail="Password must be at least 10 characters")
    user = User(email=email, full_name=payload.full_name.strip(), password_hash=hash_password(payload.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(str(user.id), user.role)}


@api_router.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == str(payload.email).lower()).first()
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return {"access_token": create_access_token(str(user.id), user.role)}


@api_router.get("/auth/me", response_model=UserResponse)
def who_am_i(user: User = Depends(current_user)):
    return user


@api_router.get("/dashboard/enterprise")
@api_router.get("/dashboard/metrics")
async def dashboard(db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return await SecurityDashboard.build_overview(db)


@api_router.get("/threats")
def list_threats(limit: int = 50, db: Session = Depends(get_db), _user: User = Depends(current_user)):
    rows = db.query(ThreatEvent).order_by(ThreatEvent.created_at.desc()).limit(max(1, min(limit, 200))).all()
    return [{"id": row.id, "event_type": row.event_type, "source_ip": row.source_ip, "severity": row.severity, "confidence": row.confidence, "description": row.description, "metadata": row.event_metadata, "created_at": row.created_at.isoformat()} for row in rows]


@api_router.post("/security/scan-code")
async def scan_code(file: UploadFile = File(...), _user: User = Depends(current_user)):
    limit = settings.max_upload_size_bytes
    raw = await file.read(limit + 1) if limit is not None else await file.read()
    if limit is not None and len(raw) > limit:
        raise HTTPException(status_code=413, detail="File exceeds the configured upload size limit")
    content = raw.decode("utf-8", errors="replace")
    return await CodeScanner.scan_code(file.filename or "upload.txt", content)


@api_router.post("/intelligence/analyze")
async def analyze_vulnerability(payload: VulnerabilityAnalysisRequest, _user: User = Depends(current_user)):
    if len(payload.content) > MAX_TEXT_SIZE:
        raise HTTPException(status_code=413, detail="Text exceeds the analysis size limit")
    return await VulnerabilityIntelligence.analyze_code(payload.filename, payload.content)


@api_router.post("/intelligence/lookup")
async def lookup_intelligence(payload: ThreatIntelRequest, _user: User = Depends(current_user)):
    return await ThreatIntelligence.analyze_indicator(payload.indicator, payload.kind, payload.user_agent)


@api_router.post("/prompt-firewall/analyze")
async def prompt_analysis(payload: PromptAnalysisRequest, _user: User = Depends(current_user)):
    return await PromptFirewall.analyze(payload.prompt[:MAX_TEXT_SIZE])


@api_router.post("/log-analyzer/analyze")
async def log_analysis(payload: LogAnalysisRequest, _user: User = Depends(current_user)):
    logs = payload.logs
    if isinstance(logs, str) and len(logs) > MAX_TEXT_SIZE:
        raise HTTPException(status_code=413, detail="Log input exceeds the analysis size limit")
    return await analyze_logs(logs)


@api_router.post("/phishing-detector/analyze")
async def phishing_analysis(payload: PhishingAnalysisRequest, _user: User = Depends(current_user)):
    if len(payload.content) > MAX_TEXT_SIZE:
        raise HTTPException(status_code=413, detail="Text exceeds the analysis size limit")
    return await analyze_phishing(payload.content)


@api_router.post("/malware-analyzer/analyze")
async def malware_analysis(payload: MalwareAnalysisRequest, _user: User = Depends(current_user)):
    if len(payload.content) > MAX_TEXT_SIZE:
        raise HTTPException(status_code=413, detail="Text exceeds the analysis size limit")
    return await analyze_malware(payload.content, payload.filename)


@api_router.post("/threats/hunt")
async def hunt_threats(payload: ThreatHuntRequest, _user: User = Depends(current_user)):
    return await ThreatHunter.analyze_logs([entry.model_dump(mode="json") for entry in payload.logs])


@api_router.post("/simulate-attack")
async def simulate_attack(_user: User = Depends(current_user)):
    event = generate_attack_event()
    event["terminal_logs"] = build_terminal_logs(event)
    event["ai_analysis"] = await build_ai_analysis(event)
    db = SessionLocal()
    try:
        db.add(ThreatEvent(event_type=event["attack"], source_ip=event["source_ip"], severity=event["severity"], confidence=event["risk_score"] / 100, description=f"Simulated {event['attack']} against {event['target']}", event_metadata={"attack": event, "status": event["status"].lower()}))
        db.commit()
    finally:
        db.close()
    await ws_manager.broadcast_json({"channel": "attack_simulation", "payload": event})
    return event


@api_router.post("/incidents/plan")
async def incident_plan(payload: IncidentPlanRequest, db: Session = Depends(get_db), _user: User = Depends(current_user)):
    plan = await IncidentResponse.generate_plan(payload.threat_type, payload.severity, payload.context)
    db.add(IncidentPlan(threat_type=payload.threat_type, severity=payload.severity, recommendations={"steps": plan["recommendations"], "containment": plan["containment_steps"], "recovery": plan["recovery_steps"]}, ai_explanation=plan["ai_explanation"]))
    db.commit()
    return plan


@api_router.post("/reports/generate/incident")
async def create_incident_report(payload: IncidentPlanRequest, request: Request, db: Session = Depends(get_db), user: User = Depends(current_user)):
    plan = await IncidentResponse.generate_plan(payload.threat_type, payload.severity, payload.context)
    safe = lambda value: str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    sections = [("Incident summary", safe(plan["attack_summary"])), ("Explanation", safe(plan["ai_explanation"])), ("Containment", safe("\n".join(plan["containment_steps"]))), ("Recommendations", safe("\n".join(plan["recommendations"]))), ("Recovery", safe("\n".join(plan["recovery_steps"]))) ]
    content = ReportService.build_pdf_report("SentinelAI Incident Response Report", sections)
    default_report_dir = Path(__file__).resolve().parents[3] / "generated" / "reports"
    output_dir = Path(getattr(request.app.state, "report_dir", default_report_dir))
    output_dir.mkdir(parents=True, exist_ok=True)
    filename = f"incident-{user.id}-{os.urandom(8).hex()}.pdf"
    report_path = output_dir / filename
    report_path.write_bytes(content)
    report = Report(user_id=user.id, report_type="incident", file_path=str(report_path))
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"plan": plan, "download_path": f"/api/v1/reports/{report.id}/download"}


@api_router.get("/reports/{report_id}/download")
def download_report(report_id: int, db: Session = Depends(get_db), user: User = Depends(current_user)):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user.id).first()
    if report is None or not Path(report.file_path).is_file():
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(report.file_path, media_type="application/pdf", filename=Path(report.file_path).name)


@api_router.post("/copilot/chat")
async def copilot_chat(payload: CopilotChatRequest, _user: User = Depends(current_user)):
    return await SecurityCopilot.respond(payload.message[:MAX_TEXT_SIZE], payload.context, [message.model_dump() for message in (payload.history or [])], payload.provider)


@api_router.get("/security-center/state")
def security_state(_user: User = Depends(current_user)):
    return get_security_state()


@api_router.get("/security-center/overview")
def security_overview(_user: User = Depends(current_user)):
    return {**get_security_state(), "activity": [], "integrity": 100, "capture": live_capture.overview(), "traffic": traffic_engine.overview()}


@api_router.post("/security-center/lockdown/initiate")
async def lockdown(_user: User = Depends(current_user)):
    return await initiate_lockdown()


@api_router.post("/security-center/lockdown/release")
async def release(_user: User = Depends(current_user)):
    return await release_lockdown()


@api_router.post("/security-center/mode")
async def security_mode(payload: dict = Body(...), _user: User = Depends(current_user)):
    mode = str(payload.get("mode", "MONITORING")).upper()
    if mode not in {"SAFE", "MONITORING", "DEFENSE", "LOCKDOWN"}:
        raise HTTPException(status_code=422, detail="Unsupported security mode")
    return await set_security_mode(mode)


@api_router.post("/security-center/predict")
def security_prediction(payload: dict = Body(default={}), db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return predict_threat(db, payload)


@api_router.post("/security-center/recommendations")
def security_recommendations(payload: dict = Body(default={}), db: Session = Depends(get_db), _user: User = Depends(current_user)):
    return build_recommendations(db, payload)


@api_router.get("/unidirectional/overview")
def unidirectional_overview(_user: User = Depends(current_user)):
    return traffic_engine.overview()


@api_router.post("/unidirectional/demo/{operation}")
async def unidirectional_demo(operation: str, payload: dict = Body(default={}), _user: User = Depends(current_user)):
    try:
        if operation == "start":
            await traffic_engine.start(str(payload.get("scenario", "normal")), float(payload.get("speed", 1)))
        elif operation == "pause":
            await traffic_engine.pause()
        elif operation == "stop":
            await traffic_engine.stop()
        elif operation == "reset":
            traffic_engine.reset()
        else:
            raise HTTPException(status_code=404, detail="Unknown demo operation")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return traffic_engine.overview()


@api_router.post("/unidirectional/analyze-pcap")
async def analyze_pcap(file: UploadFile = File(...), _user: User = Depends(current_user)):
    limit = settings.max_pcap_size_bytes
    raw = await file.read(limit + 1)
    if len(raw) > limit:
        raise HTTPException(status_code=413, detail="PCAP exceeds the configured upload size limit")
    suffix = Path(file.filename or "capture.pcap").suffix.lower()
    if suffix not in {".pcap", ".pcapng", ".cap"}:
        suffix = ".pcap"
    try:
        with tempfile.TemporaryDirectory() as temporary_directory:
            capture_path = Path(temporary_directory) / f"capture{suffix}"
            capture_path.write_bytes(raw)
            flows = await asyncio.to_thread(extract_flows, capture_path)
        alerts = 0
        for flow in flows[:100_000]:
            result = await traffic_engine.analyse(flow, "pcap_upload")
            alerts += int(result["alert"] is not None)
        return {"flows_analyzed": min(len(flows), 100_000), "alerts_generated": alerts, "metadata_only": True}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=422, detail="Unable to parse capture file")


@api_router.get("/unidirectional/live/interfaces")
def live_interfaces(_user: User = Depends(current_user)):
    return live_capture.interfaces()


@api_router.get("/unidirectional/live/status")
def live_status(_user: User = Depends(current_user)):
    return live_capture.overview()


@api_router.post("/unidirectional/live/{operation}")
async def live_operation(operation: str, payload: dict = Body(default={}), _user: User = Depends(current_user)):
    if operation == "start":
        interface = str(payload.get("interface", ""))
        if not interface:
            raise HTTPException(status_code=422, detail="An interface is required")
        return await live_capture.start(interface)
    if operation == "stop":
        return await live_capture.stop()
    if operation == "pause":
        return await live_capture.pause()
    raise HTTPException(status_code=404, detail="Unknown live capture operation")


@api_router.get("/simulate-attack")
async def simulate_attack_get(_user: User = Depends(current_user)):
    return await simulate_attack(_user)


@api_router.post("/terminal/exec")
def terminal_exec(payload: dict = Body(...), _user: User = Depends(current_user)):
    command = str(payload.get("command", "")).strip().lower()
    allowed = {
        "help": "Available simulated commands: help, status, clear",
        "status": "SentinelAI services: API online; database connected; passive capture stopped",
        "clear": "Console cleared",
    }
    if command not in allowed:
        return {"output": "Command not available. This console runs simulated, allow-listed commands only."}
    return {"output": allowed[command]}


async def _websocket_feed(websocket: WebSocket, manager):
    await websocket.accept()
    registered = False
    try:
        raw_auth = await asyncio.wait_for(websocket.receive_text(), timeout=5)
        auth_message = json.loads(raw_auth)
        token = auth_message.get("token") if isinstance(auth_message, dict) else None
        if not isinstance(token, str) or not token:
            await websocket.close(code=1008, reason="Authentication required")
            return
        db = SessionLocal()
        try:
            user = _user_from_token(token, db)
        finally:
            db.close()
        if user is None:
            await websocket.close(code=1008, reason="Invalid access token")
            return
        manager.active_connections.append(websocket)
        registered = True
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.close(code=1008, reason="WebSocket authentication failed")
        except Exception:
            pass
    finally:
        if registered:
            manager.disconnect(websocket)


@api_router.websocket("/ws/alerts")
async def alerts_socket(websocket: WebSocket):
    await _websocket_feed(websocket, ws_manager)


@api_router.websocket("/ws/unidirectional")
async def unidirectional_socket(websocket: WebSocket):
    await _websocket_feed(websocket, traffic_engine.ws)
