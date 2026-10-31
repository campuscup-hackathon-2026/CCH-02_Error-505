from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.threat_event import ThreatEvent
from app.models.user import User
from app.schemas.security import ThreatHuntRequest
from app.services.threat_hunter import ThreatHunter
from app.services.websocket_manager import ws_manager


router = APIRouter()


@router.post("/hunt")
async def hunt_threats(
    request: Request,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Accept JSON body or newline-delimited JSON text payloads.
    import json
    from datetime import datetime

    content_type = request.headers.get("content-type", "")
    logs_raw = None
    if "application/json" in content_type:
        try:
            payload = await request.json()
            logs_raw = payload.get("logs") if isinstance(payload, dict) else payload
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid JSON payload")
    else:
        body_bytes = await request.body()
        text = body_bytes.decode("utf-8", errors="ignore").strip()
        # Try parse as JSON array or object
        try:
            parsed = json.loads(text)
            logs_raw = parsed.get("logs") if isinstance(parsed, dict) else parsed
        except Exception:
            # Fallback: newline-delimited JSON objects
            lines = [l.strip() for l in text.splitlines() if l.strip()]
            parsed_lines = []
            for l in lines:
                try:
                    parsed_lines.append(json.loads(l))
                except Exception:
                    # ignore non-json lines
                    continue
            logs_raw = parsed_lines

    if not logs_raw or not isinstance(logs_raw, list):
        raise HTTPException(status_code=400, detail="No valid logs provided; expect a JSON list of log entries or newline-delimited JSON objects.")

    # Normalize and validate entries
    normalized = []
    for entry in logs_raw:
        if not isinstance(entry, dict):
            continue
        # Ensure timestamp is ISO string or datetime
        ts = entry.get("timestamp")
        if isinstance(ts, str):
            try:
                entry["timestamp"] = datetime.fromisoformat(ts)
            except Exception:
                entry["timestamp"] = datetime.utcnow()
        elif ts is None:
            entry["timestamp"] = datetime.utcnow()

        # Ensure required keys exist
        for k in ("source_ip", "action", "status", "user_agent"):
            entry.setdefault(k, "")

        normalized.append(entry)

    result = await ThreatHunter.analyze_logs(normalized)

    for alert in result["alerts"]:
        event = ThreatEvent(
            event_type=alert["type"],
            source_ip=alert["source_ip"],
            severity=alert["severity"],
            confidence=alert["confidence"],
            description=alert["description"],
            event_metadata={"origin": "threat_hunter", "predicted_next_severity": result["predicted_next_severity"]},
        )
        db.add(event)
        await ws_manager.broadcast_json({"channel": "threat_alert", "payload": alert})

    db.commit()
    return result