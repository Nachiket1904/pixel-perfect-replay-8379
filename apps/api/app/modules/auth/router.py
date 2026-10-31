from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status
from fastapi.responses import JSONResponse
from redis.asyncio import Redis

from app.core.config import get_settings
from app.core.deps import SessionDep
from app.core.errors import NotAuthenticated, error_body
from app.core.ratelimit import email_key, hit
from app.core.redis import get_redis
from app.modules.auth import service
from app.modules.auth.cookies import REFRESH_COOKIE, clear_auth_cookies, set_auth_cookies
from app.modules.auth.schemas import LoginIn, RegisterIn
from app.modules.users.schemas import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

RedisDep = Annotated[Redis, Depends(get_redis)]


def _client_ip(request: Request) -> str:
    # Behind a proxy, run uvicorn with --proxy-headers so request.client is the real client IP.
    return request.client.host if request.client else "unknown"


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterIn, request: Request, response: Response, session: SessionDep, redis: RedisDep
):
    await hit(redis, f"register:ip:{_client_ip(request)}", get_settings().auth_ip_limit_per_minute)
    user = await service.register(session, data)
    pair = await service.issue_tokens(session, user, user_agent=request.headers.get("user-agent"))
    await session.commit()
    set_auth_cookies(response, pair.access, pair.refresh)
    return user


@router.post("/login", response_model=UserOut)
async def login(data: LoginIn, request: Request, response: Response, session: SessionDep, redis: RedisDep):
    settings = get_settings()
    # Two limits: per IP (spraying many accounts) and per email (hammering one account).
    await hit(redis, f"login:ip:{_client_ip(request)}", settings.auth_ip_limit_per_minute)
    await hit(redis, f"login:email:{email_key(data.email)}", settings.login_email_limit_per_minute)
    user = await service.authenticate(session, data)
    pair = await service.issue_tokens(session, user, user_agent=request.headers.get("user-agent"))
    await session.commit()
    set_auth_cookies(response, pair.access, pair.refresh)
    return user


@router.post("/refresh", response_model=UserOut)
async def refresh(
    request: Request,
    response: Response,
    session: SessionDep,
    redis: RedisDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
):
    await hit(redis, f"refresh:ip:{_client_ip(request)}", 30)
    try:
        if not refresh_token:
            raise NotAuthenticated("Your session has expired. Please log in again.")
        user, pair = await service.rotate(
            session, refresh_token, user_agent=request.headers.get("user-agent")
        )
    except NotAuthenticated as exc:
        # Build the error response ourselves so the dead cookies are cleared in the same response.
        failed = JSONResponse(error_body(exc.code, exc.message), status_code=exc.status_code)
        clear_auth_cookies(failed)
        return failed
    await session.commit()
    set_auth_cookies(response, pair.access, pair.refresh)
    return user


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
async def logout(
    session: SessionDep,
    refresh_token: Annotated[str | None, Cookie(alias=REFRESH_COOKIE)] = None,
) -> Response:
    await service.logout(session, refresh_token)
    await session.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    clear_auth_cookies(response)
    return response
