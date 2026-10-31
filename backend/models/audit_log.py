from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import mapped_column

from app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = mapped_column(Integer, primary_key=True, index=True)
    user_id = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    request_path = mapped_column(String(255), nullable=False)
    request_method = mapped_column(String(20), nullable=False)
    status_code = mapped_column(Integer, nullable=False)
    ip_address = mapped_column(String(100), nullable=False)
    role = mapped_column(String(50), default="anonymous", nullable=False)
    action = mapped_column(String(100), nullable=False)
    event_metadata = mapped_column(JSON, nullable=False)
    detail = mapped_column(Text, nullable=False)
    created_at = mapped_column(DateTime, default=datetime.utcnow, nullable=False)