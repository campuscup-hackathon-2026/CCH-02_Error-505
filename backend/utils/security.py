from datetime import datetime, timedelta, timezone
import base64
import hashlib
import hmac
import os

from jose import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.scrypt(password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return "scrypt$" + base64.b64encode(salt + key).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password.startswith("scrypt$"):
        return False

    raw = base64.b64decode(hashed_password.split("$", 1)[1].encode("utf-8"))
    salt, stored_key = raw[:16], raw[16:]
    computed = hashlib.scrypt(plain_password.encode("utf-8"), salt=salt, n=2**14, r=8, p=1)
    return hmac.compare_digest(stored_key, computed)


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": subject, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
