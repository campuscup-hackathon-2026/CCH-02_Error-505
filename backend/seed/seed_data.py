from datetime import datetime, timedelta
import os

from app.db.session import Base, SessionLocal, engine
from app.models.threat_event import ThreatEvent
from app.models.user import User
from app.models.vulnerability import VulnerabilityScan
from app.utils.security import hash_password


Base.metadata.create_all(bind=engine)

db = SessionLocal()

try:
    admin = db.query(User).filter(User.email == 'admin@sentinel.example.com').first()
    if not admin:
        seed_pwd = os.environ.get('SEED_ADMIN_PASSWORD', 'Admin@12345')
        admin = User(
            email='admin@sentinel.example.com',
            full_name='Sentinel Admin',
            password_hash=hash_password(seed_pwd),
            role='admin',
        )
        db.add(admin)
        db.flush()

    for i in range(1, 6):
        db.add(
            VulnerabilityScan(
                user_id=admin.id,
                filename=f'service_{i}.py',
                risk_score=min(95, 15 * i),
                severity='high' if i > 3 else 'medium',
                findings=[{'type': 'sql_injection', 'line': 30 + i, 'severity': 'high'}],
                ai_summary='Potential SQL injection in dynamic query construction.',
                generated_fixes={str(30 + i): {'suggestion': 'Use parameterized query placeholders.'}},
            )
        )

    for idx in range(12):
        db.add(
            ThreatEvent(
                event_type='brute_force' if idx % 2 == 0 else 'ddos_like_pattern',
                source_ip=f'10.0.1.{idx + 10}',
                severity='high' if idx % 2 == 0 else 'critical',
                confidence=0.75 + (idx % 3) * 0.05,
                description='Seeded demo threat event for SOC timeline.',
                event_metadata={
                    'attempts': 12 + idx,
                    'region': 'us-east',
                    'protocol': 'https',
                    'captured_at': (datetime.utcnow() - timedelta(minutes=idx * 5)).isoformat(),
                },
            )
        )

    db.commit()
    print(f"Seed completed. Default admin: admin@sentinel.example.com / {os.environ.get('SEED_ADMIN_PASSWORD', 'Admin@12345')}")
finally:
    db.close()