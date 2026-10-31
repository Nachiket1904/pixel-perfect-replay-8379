import uuid
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import AppError, NotAuthenticated
from app.core.security import (
    create_access_token,
    hash_password,
    hash_refresh_token,
    new_refresh_token,
    verify_password,
)
from app.modules.auth.models import RefreshToken
from app.modules.auth.schemas import LoginIn, RegisterIn
from app.modules.users.models import User


class TokenPair:
    def __init__(self, access: str, refresh: str) -> None:
        self.access = access
        self.refresh = refresh


async def register(session: AsyncSession, data: RegisterIn) -> User:
    user = User(email=data.email, name=data.name, password_hash=hash_password(data.password))
    session.add(user)
    try:
        await session.flush()
    except IntegrityError as exc:
        await session.rollback()
        raise AppError(
            "EMAIL_TAKEN",
            "An account with this email already exists. Try logging in.",
            status.HTTP_409_CONFLICT,
        ) from exc
    return user


async def authenticate(session: AsyncSession, data: LoginIn) -> User:
    user = await session.scalar(select(User).where(User.email == data.email, User.deleted_at.is_(None)))
    # verify_password runs even when the user doesn't exist (constant-ish timing).
    password_ok = verify_password(data.password, user.password_hash if user else None)
    if user is None or not password_ok:
        raise NotAuthenticated("Email or password is incorrect.")
    return user


async def issue_tokens(
    session: AsyncSession, user: User, family_id: uuid.UUID | None = None, user_agent: str | None = None
) -> TokenPair:
    settings = get_settings()
    raw, token_hash = new_refresh_token()
    session.add(
        RefreshToken(
            user_id=user.id,
            token_hash=token_hash,
            family_id=family_id or uuid.uuid4(),
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_ttl_days),
            user_agent=(user_agent or "")[:300] or None,
        )
    )
    user.last_active_at = datetime.now(UTC)
    await session.flush()
    return TokenPair(create_access_token(user.id, user.role.value), raw)


async def rotate(
    session: AsyncSession, raw_refresh: str, user_agent: str | None = None
) -> tuple[User, TokenPair]:
    """Exchange a refresh token for a new pair. Detects reuse of an old token."""
    token = await session.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_refresh_token(raw_refresh))
        .with_for_update()
    )
    if token is None:
        raise NotAuthenticated("Your session has expired. Please log in again.")

    now = datetime.now(UTC)
    if token.revoked_at is not None:
        # A rotated token came back: it was stolen or replayed. Kill the whole session family.
        await _revoke_family(session, token.family_id, now)
        await session.commit()
        raise NotAuthenticated("Your session has expired. Please log in again.")
    if token.expires_at <= now:
        raise NotAuthenticated("Your session has expired. Please log in again.")

    user = await session.get(User, token.user_id)
    if user is None or user.deleted_at is not None:
        raise NotAuthenticated()

    token.revoked_at = now
    pair = await issue_tokens(session, user, family_id=token.family_id, user_agent=user_agent)
    return user, pair


async def logout(session: AsyncSession, raw_refresh: str | None) -> None:
    if not raw_refresh:
        return
    token = await session.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(raw_refresh))
    )
    if token is not None:
        await _revoke_family(session, token.family_id, datetime.now(UTC))


async def _revoke_family(session: AsyncSession, family_id: uuid.UUID, now: datetime) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
