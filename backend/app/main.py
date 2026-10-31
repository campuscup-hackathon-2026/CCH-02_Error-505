import asyncio
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import Base, SessionLocal, engine
from app.middleware.security import SecurityMiddleware
from app.models.threat_event import ThreatEvent
from app.services.demo_feed import generate_demo_feed_item, generate_demo_notification
from app.services.lockdown_controller import get_security_state
from app.services.simulation import simulated_attack_event
from app.services.websocket_manager import ws_manager
from app.services.unidirectional.engine import traffic_engine
from app.services.realtime.manager import live_capture

app = FastAPI(title=settings.app_name)

allow_origins = [settings.frontend_origin]
if settings.environment == "development":
    allow_origins.extend(
        [
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://127.0.0.1:5174",
            "http://localhost:5174",
            "http://192.168.31.40:5173",
            "http://192.168.31.40:5174",
        ]
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=(
        r"^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$"
        if settings.environment == "development"
        else None
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityMiddleware)
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
def health():
    database_status = "healthy"
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
    except Exception:
        database_status = "unavailable"

    capture_status = getattr(live_capture, "status", "STOPPED").lower()
    capture_health = "healthy" if capture_status in {"live", "stopped", "paused"} else "degraded"
    return {
        "status": "ok" if database_status == "healthy" else "degraded",
        "service": settings.app_name,
        "backend": "healthy",
        "database": database_status,
        "capture": capture_health,
        "capture_status": capture_status,
        "simulation_status": traffic_engine.mode.lower(),
        "ml": "not_configured",
        "websocket": "healthy",
    }


async def simulation_loop():
    while True:
        event = simulated_attack_event()
        db = SessionLocal()
        try:
            db.add(
                ThreatEvent(
                    event_type=event["event_type"],
                    source_ip=event["source_ip"],
                    severity=event["severity"],
                    confidence=event["confidence"],
                    description=event["description"],
                    event_metadata=event["metadata"],
                )
            )
            db.commit()
        finally:
            db.close()
        await ws_manager.broadcast_json({"channel": "simulation_alert", "payload": event})
        await asyncio.sleep(settings.simulation_interval_seconds)


async def demo_feed_loop():
    while True:
        item = generate_demo_feed_item()
        await ws_manager.broadcast_json({"channel": "threat_feed_update", "payload": item})
        await ws_manager.broadcast_json({"channel": "threat_map_update", "payload": item})
        if item["severity"] in {"HIGH", "CRITICAL"}:
            await ws_manager.broadcast_json(
                {"channel": "notification", "payload": generate_demo_notification(item)}
            )
        await asyncio.sleep(12)


async def security_center_loop():
    cycle = 0
    while True:
        state = get_security_state()
        if state["mode"] == "LOCKDOWN":
            activity = [
                "[LOCKDOWN] AI Firewall Enabled",
                "[LOCKDOWN] Blocking suspicious traffic",
                "[LOCKDOWN] Isolating infected systems",
                "[LOCKDOWN] Emergency protocols activated",
            ]
            integrity_score, threat_level = max(25, 45 - cycle % 7), "CRITICAL"
        elif state["mode"] == "DEFENSE":
            activity = [
                "[DEFENSE] Tightening perimeter rules",
                "[DEFENSE] Verifying endpoint telemetry",
                "[DEFENSE] Elevated monitoring in effect",
            ]
            integrity_score, threat_level = 72 - cycle % 4, "HIGH"
        elif state["mode"] == "SAFE":
            activity = [
                "[SAFE] Passive monitoring active",
                "[SAFE] No critical anomalies detected",
                "[SAFE] Routine SOC health checks complete",
            ]
            integrity_score, threat_level = 96 - cycle % 2, "LOW"
        else:
            activity = [
                "[INFO] Monitoring network traffic",
                "[HIGH] Prompt injection blocked",
                "[CRITICAL] Malware behavior detected",
                "[SAFE] Firewall operational",
            ]
            integrity_score, threat_level = 84 - cycle % 6, "MEDIUM"

        payload = {
            "mode": state["mode"],
            "lockdown": state["lockdown"],
            "threat_level": threat_level,
            "firewall_status": "Enabled" if state["mode"] != "SAFE" else "Standby",
            "system_integrity": integrity_score,
            "cpu_usage": 34 + cycle % 22,
            "memory_usage": 41 + cycle % 18,
            "active_scans": 3 + cycle % 4,
            "ai_load": 28 + cycle % 20,
            "critical_alerts": 1 if state["mode"] == "LOCKDOWN" else 0,
            "activity": activity,
            "timestamp": cycle,
        }
        await ws_manager.broadcast_json(
            {
                "channel": "soc_activity",
                "payload": {
                    "entry": activity[cycle % len(activity)],
                    "severity": threat_level,
                    "timestamp": cycle,
                },
            }
        )
        await ws_manager.broadcast_json({"channel": "integrity_update", "payload": payload})
        await asyncio.sleep(6)
        cycle += 1


@app.on_event("startup")
async def on_startup():
    Base.metadata.create_all(bind=engine)
    await traffic_engine.start_workers()
    live_capture.set_flow_sink(traffic_engine.submit)
    app.state.simulation_task = asyncio.create_task(simulation_loop())
    app.state.demo_feed_task = asyncio.create_task(demo_feed_loop())
    app.state.security_center_task = asyncio.create_task(security_center_loop())


@app.on_event("shutdown")
async def on_shutdown():
    for task_name in ("simulation_task", "demo_feed_task", "security_center_task"):
        task = getattr(app.state, task_name, None)
        if task:
            task.cancel()
    await traffic_engine.shutdown()
    await live_capture.stop()


web_dist_setting = os.environ.get("WEB_DIST_DIR")
web_dist_dir = Path(web_dist_setting).resolve() if web_dist_setting else None
if web_dist_dir and web_dist_dir.is_dir():
    @app.get("/{client_path:path}", include_in_schema=False)
    async def frontend_application(client_path: str):
        assert web_dist_dir is not None
        requested_file = (web_dist_dir / client_path).resolve()
        if requested_file.is_relative_to(web_dist_dir) and requested_file.is_file():
            return FileResponse(requested_file)
        return FileResponse(web_dist_dir / "index.html")
