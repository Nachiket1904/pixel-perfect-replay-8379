import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import get_settings
from app.core.csrf import OriginCheckMiddleware
from app.core.db import engine
from app.core.errors import register_error_handlers
from app.core.redis import create_redis
from app.modules.auth.router import router as auth_router
from app.modules.exercises.router import router as exercises_router
from app.modules.health.router import router as health_router
from app.modules.progress.router import router as progress_router
from app.modules.roadmaps.router import router as roadmaps_router
from app.modules.users.router import router as users_router

API_PREFIX = "/api/v1"
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.redis = create_redis(get_settings().redis_url)
    yield
    await app.state.redis.aclose()
    await engine.dispose()


async def security_headers(request, call_next):  # type: ignore[no-untyped-def]
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        # Swagger UI only outside production.
        docs_url="/docs" if settings.env != "production" else None,
        redoc_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json" if settings.env != "production" else None,
    )

    # Middleware runs bottom-up: CORS answers preflights first, then the Origin check.
    app.add_middleware(BaseHTTPMiddleware, dispatch=security_headers)
    app.add_middleware(OriginCheckMiddleware, allowed_origins=settings.cors_origins)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,  # cookies
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type"],
    )

    register_error_handlers(app)
    app.include_router(health_router)
    app.include_router(auth_router, prefix=API_PREFIX)
    app.include_router(users_router, prefix=API_PREFIX)
    app.include_router(roadmaps_router, prefix=API_PREFIX)
    app.include_router(progress_router, prefix=API_PREFIX)
    app.include_router(exercises_router, prefix=API_PREFIX)
    return app


app = create_app()
