from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class ExecRequest(BaseModel):
    command: str


@router.post('/exec')
async def exec_command(req: ExecRequest):
    # WARNING: this is a safe, mocked implementation.
    # Do not execute arbitrary commands on the server without strict access controls.
    cmd = req.command.strip()
    if not cmd:
        return {"output": "No command provided", "status": "error"}

    # Provide a small set of safe mocked responses for convenience
    if cmd in ('status', 'health'):
        return {"output": "OK - SentinelAI backend healthy", "status": "ok"}
    if cmd == 'list scans':
        return {"output": "scan-2026-05-27, scan-2026-05-28", "status": "ok"}

    # Fallback: echo command back
    return {"output": f"Echo: {cmd}", "status": "ok"}