from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from redis.exceptions import RedisError
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.db import SessionLocal

router = APIRouter(tags=["health"])


@router.get("/health")
async def health(request: Request) -> JSONResponse:
    """Liveness + dependency check for uptime monitors and the hosting platform.

    The database is required (503 if down). Redis is reported but not required,
    because the app degrades gracefully without it (rate limits fail open).
    """
    checks = {"db": "ok", "redis": "ok"}
    try:
        async with SessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError):
        checks["db"] = "down"
    try:
        await request.app.state.redis.ping()
    except (RedisError, OSError):
        checks["redis"] = "down"

    ok = checks["db"] == "ok"
    return JSONResponse({"status": "ok" if ok else "degraded", **checks}, status_code=200 if ok else 503)
