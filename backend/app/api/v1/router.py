from fastapi import APIRouter

from app.api.v1.endpoints import attack_simulator, auth, copilot, dashboard, demo, incidents, intelligence, log_analyzer, malware_analyzer, phishing_detector, prompts, realtime, reports, security, security_center, threats, unidirectional, websocket, terminal


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(security.router, prefix="/security", tags=["security"])
api_router.include_router(intelligence.router, prefix="/intelligence", tags=["intelligence"])
api_router.include_router(prompts.router, prefix="/prompt-firewall", tags=["prompt-firewall"])
api_router.include_router(threats.router, prefix="/threats", tags=["threats"])
api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
api_router.include_router(copilot.router, prefix="/copilot", tags=["copilot"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(demo.router, prefix="/demo", tags=["demo"])
api_router.include_router(reports.router, prefix="/reports", tags=["reports"])
api_router.include_router(websocket.router, prefix="/ws", tags=["websocket"])
api_router.include_router(terminal.router, prefix="/terminal", tags=["terminal"])
api_router.include_router(attack_simulator.router, tags=["attack-simulator"])
api_router.include_router(phishing_detector.router, prefix="/phishing-detector", tags=["phishing-detector"])
api_router.include_router(log_analyzer.router, prefix="/log-analyzer", tags=["log-analyzer"])
api_router.include_router(malware_analyzer.router, prefix="/malware-analyzer", tags=["malware-analyzer"])
api_router.include_router(security_center.router, prefix="/security-center", tags=["security-center"])
api_router.include_router(unidirectional.router, prefix="/unidirectional", tags=["unidirectional"])
api_router.include_router(realtime.router, prefix="/realtime", tags=["realtime"])