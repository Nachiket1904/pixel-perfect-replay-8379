import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

# Argon2id with pwdlib's recommended parameters.
_password_hash = PasswordHash.recommended()
# Used when the email doesn't exist, so login takes the same time either way (no user enumeration by timing).
_DUMMY_HASH = _password_hash.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _password_hash.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _password_hash.verify(password, _DUMMY_HASH)
        return False
    return _password_hash.verify(password, password_hash)


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "iss": settings.jwt_issuer,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_ttl_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict:
    """Raises jwt.PyJWTError if the token is invalid, expired or not an access token."""
    settings = get_settings()
    payload = jwt.decode(
        token,
        settings.jwt_secret.get_secret_value(),
        algorithms=[settings.jwt_algorithm],  # pin the algorithm: never trust the token header
        issuer=settings.jwt_issuer,
        options={"require": ["exp", "iat", "sub", "iss"]},
    )
    if payload.get("type") != "access":
        raise jwt.InvalidTokenError("Not an access token")
    return payload


def new_refresh_token() -> tuple[str, str]:
    """Returns (raw token for the cookie, sha256 hash for the database).

    Refresh tokens are random, not JWTs: they're only ever checked against the DB,
    and storing just the hash means a DB leak doesn't leak usable tokens.
    """
    raw = secrets.token_urlsafe(48)
    return raw, hash_refresh_token(raw)


def hash_refresh_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()
