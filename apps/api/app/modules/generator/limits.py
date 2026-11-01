"""Day 20: limits around the generator.

- Daily quota: successful AI roadmaps per learner per IST day, counted from the database
  (durable, and correct even if Redis restarts).
- Attempt limit: LLM calls per learner per day in Redis, so rejected goals can't burn money.
- One generation at a time per learner (Redis lock), so parallel clicks can't beat the quota.
- Global daily spend cap from real token usage. This one FAILS CLOSED: if Redis is down we
  can't know what we've spent, so the generator pauses instead of risking the bill.
"""

import logging
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import status as http
from redis.asyncio import Redis
from redis.exceptions import RedisError
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.core.errors import AppError
from app.modules.generator.llm import LLMResult
from app.modules.generator.schemas import QuotaOut
from app.modules.generator.service import unavailable
from app.modules.roadmaps.models import Roadmap, RoadmapSource
from app.modules.users.models import User

log = logging.getLogger(__name__)
TZ = ZoneInfo("Asia/Kolkata")
LOCK_SECONDS = 120  # longer than two LLM calls; expires on its own if the worker dies


def _today_window() -> tuple[datetime, datetime]:
    today = datetime.now(TZ).date()
    start = datetime.combine(today, time.min, tzinfo=TZ)
    return start, start + timedelta(days=1)


async def quota(session: AsyncSession, user: User, settings: Settings) -> QuotaOut:
    start, end = _today_window()
    used = await session.scalar(
        select(func.count(Roadmap.id)).where(
            Roadmap.owner_id == user.id,
            Roadmap.source == RoadmapSource.ai,
            Roadmap.created_at >= start,
        )
    )
    limit = settings.generator_daily_limit
    return QuotaOut(remaining=max(0, limit - (used or 0)), limit=limit, resets_at=end)


async def require_quota(session: AsyncSession, user: User, settings: Settings) -> None:
    q = await quota(session, user, settings)
    if q.remaining <= 0:
        raise AppError(
            "RATE_LIMITED",
            f"You've used today's {q.limit} roadmaps. Try again tomorrow, or start an official roadmap.",
            http.HTTP_429_TOO_MANY_REQUESTS,
            {"limit": q.limit, "resets_at": q.resets_at.isoformat()},
        )


def _spend_key() -> str:
    return f"llm:spend:{datetime.now(TZ).date().isoformat()}"


async def require_budget(redis: Redis, settings: Settings) -> None:
    try:
        spent = float(await redis.get(_spend_key()) or 0)
    except RedisError as exc:
        log.warning("generator: spend tracker unavailable, pausing generation")
        raise unavailable() from exc
    if spent >= settings.llm_daily_budget_usd:
        log.warning("generator: daily budget reached (%.4f USD)", spent)
        raise unavailable()


def cost_usd(result: LLMResult, settings: Settings) -> float:
    return (
        result.input_tokens * settings.llm_input_usd_per_mtok
        + result.output_tokens * settings.llm_output_usd_per_mtok
    ) / 1_000_000


async def record_usage(redis: Redis, settings: Settings, result: LLMResult) -> None:
    cost = cost_usd(result, settings)
    if cost <= 0:
        return
    key = _spend_key()
    try:
        await redis.incrbyfloat(key, cost)
        await redis.expire(key, 3 * 24 * 3600)
    except RedisError:
        log.error("generator: could not record %.5f USD of LLM spend", cost)


async def acquire_lock(redis: Redis, user: User) -> str:
    key = f"gen-lock:{user.id}"
    try:
        acquired = await redis.set(key, "1", nx=True, ex=LOCK_SECONDS)
    except RedisError as exc:
        raise unavailable() from exc
    if not acquired:
        raise AppError(
            "CONFLICT",
            "We're already building a roadmap for you. Give it a few seconds.",
            http.HTTP_409_CONFLICT,
        )
    return key


async def release_lock(redis: Redis, key: str) -> None:
    try:
        await redis.delete(key)
    except RedisError:
        log.warning("generator: could not release %s (it expires on its own)", key)
