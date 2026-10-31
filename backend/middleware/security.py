from __future__ import annotations

import time
from collections import defaultdict

import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.audit_log import AuditLog
from app.services.websocket_manager import ws_manager

logger = logging.getLogger(__name__)


_request_windows: dict[str, list[float]] = defaultdict(list)


class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api/") and request.method not in {"OPTIONS"}:
            client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
            bucket_key = f"{client_ip}:{request.url.path}"
            now = time.time()
            window_start = now - settings.rate_limit_window_seconds
            timestamps = [stamp for stamp in _request_windows[bucket_key] if stamp >= window_start]
            if len(timestamps) >= settings.rate_limit_requests:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded"},
                )
            timestamps.append(now)
            _request_windows[bucket_key] = timestamps

        response = await call_next(request)

        if request.url.path.startswith("/api/"):
            await self._write_audit_log(request, response.status_code)

        return response

    async def _write_audit_log(self, request: Request, status_code: int) -> None:
        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
        user_id = None
        role = "anonymous"
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ", 1)[1].strip()
            try:
                payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
                user_id = int(payload.get("sub"))
                role = str(payload.get("role", "anonymous"))
            except (JWTError, ValueError, TypeError):
                pass

        session: Session = SessionLocal()
        try:
            session.add(
                AuditLog(
                    user_id=user_id,
                    request_path=request.url.path,
                    request_method=request.method,
                    status_code=status_code,
                    ip_address=client_ip,
                    role=role,
                    action=f"{request.method} {request.url.path}",
                    event_metadata={"query": dict(request.query_params)},
                    detail="request processed",
                )
            )
            session.commit()
            try:
                await ws_manager.broadcast_json(
                    {
                        "channel": "module_status_update",
                        "payload": {
                            "module": request.url.path,
                            "status_code": status_code,
                            "request_path": request.url.path,
                            "created_at": time.time(),
                        },
                    }
                )
            except Exception as exc:
                logger.exception("Failed to broadcast websocket audit: %s", exc)
        except Exception as exc:
            logger.exception("Failed to write audit log: %s", exc)
            session.rollback()
        finally:
            session.close()