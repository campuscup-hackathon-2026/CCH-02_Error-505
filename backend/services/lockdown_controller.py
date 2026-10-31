from __future__ import annotations

from datetime import datetime

from app.services.websocket_manager import ws_manager


SECURITY_MODES = ("SAFE", "MONITORING", "DEFENSE", "LOCKDOWN")

SECURITY_STATE = {
    "mode": "MONITORING",
    "lockdown": False,
    "intensity": "medium",
    "activated_at": None,
    "last_action": "System initialized in monitoring mode.",
}


def get_security_state() -> dict:
    return dict(SECURITY_STATE)


def _apply_mode(mode: str, lockdown: bool, action: str) -> dict:
    normalized = mode.upper()
    if normalized not in SECURITY_MODES:
        normalized = "MONITORING"

    SECURITY_STATE.update(
        {
            "mode": normalized,
            "lockdown": lockdown,
            "intensity": "critical" if normalized == "LOCKDOWN" else "high" if normalized == "DEFENSE" else "medium" if normalized == "MONITORING" else "low",
            "activated_at": datetime.utcnow().isoformat(),
            "last_action": action,
        }
    )
    return get_security_state()


async def set_security_mode(mode: str, reason: str = "manual") -> dict:
    state = _apply_mode(mode, mode.upper() == "LOCKDOWN", f"Security mode set to {mode.upper()} ({reason}).")
    await ws_manager.broadcast_json({"channel": "security_mode_update", "payload": state})
    return state


async def initiate_lockdown(reason: str = "manual") -> dict:
    state = _apply_mode("LOCKDOWN", True, f"Emergency lockdown initiated ({reason}).")
    logs = build_lockdown_logs()
    payload = {**state, "logs": logs}
    await ws_manager.broadcast_json({"channel": "security_mode_update", "payload": payload})
    await ws_manager.broadcast_json({"channel": "lockdown_state", "payload": payload})
    await ws_manager.broadcast_json({"channel": "notification", "payload": {"title": "⚠ LOCKDOWN MODE", "message": "Emergency defense mode activated.", "tone": "critical"}})
    return payload


async def release_lockdown(reason: str = "manual") -> dict:
    state = _apply_mode("MONITORING", False, f"Lockdown released ({reason}).")
    await ws_manager.broadcast_json({"channel": "security_mode_update", "payload": state})
    return state


def build_lockdown_logs() -> list[str]:
    return [
        "[LOCKDOWN] AI Firewall Enabled",
        "[LOCKDOWN] Blocking suspicious traffic",
        "[LOCKDOWN] Isolating infected systems",
        "[LOCKDOWN] Emergency protocols activated",
    ]


def mode_style(mode: str) -> dict:
    normalized = (mode or "MONITORING").upper()
    styles = {
        "SAFE": {"theme": "safe", "alert": "low"},
        "MONITORING": {"theme": "monitoring", "alert": "medium"},
        "DEFENSE": {"theme": "defense", "alert": "high"},
        "LOCKDOWN": {"theme": "lockdown", "alert": "critical"},
    }
    return styles.get(normalized, styles["MONITORING"])
