from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.incident_plan import IncidentPlan
from app.models.user import User
from app.schemas.security import IncidentPlanRequest
from app.services.incident_response import IncidentResponse


router = APIRouter()


@router.post("/plan")
async def generate_plan(
    payload: IncidentPlanRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    result = await IncidentResponse.generate_plan(payload.threat_type, payload.severity, payload.context)

    db.add(
        IncidentPlan(
            threat_type=result["threat_type"],
            severity=result["severity"],
            recommendations=result["recommendations"],
            ai_explanation=result["ai_explanation"],
        )
    )
    db.commit()

    return result