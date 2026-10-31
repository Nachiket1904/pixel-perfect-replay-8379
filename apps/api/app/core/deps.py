import uuid
from typing import Annotated

import jwt
from fastapi import Cookie, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import AppError, NotAuthenticated
from app.core.security import decode_access_token
from app.modules.auth.cookies import ACCESS_COOKIE
from app.modules.users.models import Role, User

SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def get_current_user(
    session: SessionDep,
    access_token: Annotated[str | None, Cookie(alias=ACCESS_COOKIE)] = None,
) -> User:
    if not access_token:
        raise NotAuthenticated()
    try:
        payload = decode_access_token(access_token)
        user_id = uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, ValueError, KeyError) as exc:
        raise NotAuthenticated("Your session has expired. Please log in again.") from exc

    # Load from the DB every time so deleted users and role changes take effect immediately.
    user = await session.get(User, user_id)
    if user is None or user.deleted_at is not None:
        raise NotAuthenticated()
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_role(*roles: Role):  # noqa: ANN201
    """Usage: dependencies=[Depends(require_role(Role.admin))]. RBAC is enforced here, never in the UI."""

    async def _check(user: CurrentUser) -> User:
        if user.role not in roles:
            raise AppError("FORBIDDEN", "You don't have access to this.", 403)
        return user

    return _check
