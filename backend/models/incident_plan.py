from datetime import datetime

from sqlalchemy import DateTime, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class IncidentPlan(Base):
    __tablename__ = "incident_plans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    threat_type: Mapped[str] = mapped_column(String(100), nullable=False)
    severity: Mapped[str] = mapped_column(String(50), nullable=False)
    recommendations: Mapped[dict] = mapped_column(JSON, nullable=False)
    ai_explanation: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
