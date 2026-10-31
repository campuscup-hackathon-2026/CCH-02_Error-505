from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.threat_event import ThreatEvent
from app.models.user import User
from app.models.vulnerability import VulnerabilityScan
from app.services.security_dashboard import SecurityDashboard


router = APIRouter()


@router.get("/metrics")
def dashboard_metrics(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total_scans = db.query(func.count(VulnerabilityScan.id)).scalar() or 0
    avg_risk = db.query(func.avg(VulnerabilityScan.risk_score)).scalar() or 0
    total_threats = db.query(func.count(ThreatEvent.id)).scalar() or 0

    severity_distribution = (
        db.query(ThreatEvent.severity, func.count(ThreatEvent.id))
        .group_by(ThreatEvent.severity)
        .all()
    )

    recent_threats = (
        db.query(ThreatEvent)
        .order_by(ThreatEvent.created_at.desc())
        .limit(15)
        .all()
    )

    return {
        "security_score": max(0, 100 - int(avg_risk * 0.8)),
        "total_scans": total_scans,
        "avg_risk": round(float(avg_risk), 2),
        "total_threats": total_threats,
        "severity_distribution": [{"severity": s, "count": c} for s, c in severity_distribution],
        "recent_threats": [
            {
                "id": t.id,
                "event_type": t.event_type,
                "source_ip": t.source_ip,
                "severity": t.severity,
                "confidence": t.confidence,
                "description": t.description,
                "created_at": t.created_at.isoformat(),
            }
            for t in recent_threats
        ],
    }


@router.get("/enterprise")
async def enterprise_dashboard(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await SecurityDashboard.build_overview(db)