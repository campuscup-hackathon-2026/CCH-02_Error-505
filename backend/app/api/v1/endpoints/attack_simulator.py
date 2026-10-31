from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.threat_event import ThreatEvent
from app.models.user import User
from app.services.attack_simulator import build_ai_analysis, build_terminal_logs, generate_attack_event
from app.services.websocket_manager import ws_manager


router = APIRouter()


@router.get("/simulate-attack")
async def simulate_attack(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = generate_attack_event()
    ai_analysis = await build_ai_analysis(event)
    terminal_logs = build_terminal_logs(event)

    threat = ThreatEvent(
        event_type=event["attack_type"].lower().replace(" ", "_").replace("/", "_") ,
        source_ip=event["source_ip"],
        severity=event["severity"].lower(),
        confidence=min(0.99, max(0.75, event["risk_score"] / 100)),
        description=f"{event['attack']} targeted {event['target']} and was {event['status'].lower()}.",
        event_metadata={
            "timestamp": event["timestamp"],
            "attack": event["attack"],
            "attack_type": event["attack_type"],
            "severity": event["severity"],
            "target": event["target"],
            "status": event["status"],
            "risk_score": event["risk_score"],
            "indicators": event["indicators"],
            "ai_analysis": ai_analysis,
            "terminal_logs": terminal_logs,
        },
    )
    db.add(threat)
    db.commit()

    payload = {
        **event,
        "ai_analysis": ai_analysis,
        "terminal_logs": terminal_logs,
    }

    await ws_manager.broadcast_json({"channel": "attack_simulation", "payload": payload})
    return payload