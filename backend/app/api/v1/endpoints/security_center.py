from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services.lockdown_controller import get_security_state, initiate_lockdown, release_lockdown, set_security_mode
from app.services.recommendation_engine import build_recommendations
from app.services.threat_predictor import predict_threat


router = APIRouter()


class ModeRequest(BaseModel):
    mode: str


class TelemetryRequest(BaseModel):
    failed_logins: int = 0
    suspicious_ips: int = 0
    active_threats: int = 0
    risk_score: int = 0
    malware_hits: int = 0


@router.get("/state")
def state(_: User = Depends(get_current_user)):
    return get_security_state()


@router.post("/mode")
async def mode(payload: ModeRequest, _: User = Depends(get_current_user)):
    return await set_security_mode(payload.mode)


@router.post("/lockdown/initiate")
async def lockdown(_: User = Depends(get_current_user)):
    return await initiate_lockdown()


@router.post("/lockdown/release")
async def release(_: User = Depends(get_current_user)):
    return await release_lockdown()


@router.post("/predict")
def predict(payload: TelemetryRequest, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return predict_threat(db, payload.model_dump())


@router.post("/recommendations")
def recommendations(payload: TelemetryRequest, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return build_recommendations(db, payload.model_dump())


@router.get("/overview")
def overview(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {
        "state": get_security_state(),
        "prediction": predict_threat(db),
        "recommendations": build_recommendations(db),
    }