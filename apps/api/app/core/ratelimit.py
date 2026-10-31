"""Fixed-window rate limiting in Redis: INCR a counter per key per window.

Simple and good enough for v1. Fails OPEN if Redis is down (logs a warning) so an
outage of the cache doesn't lock everyone out; Argon2 still makes brute force slow.
"""

import hashlib
import logging
import time

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.errors import RateLimited

log = logging.getLogger(__name__)


async def hit(redis: Redis, key: str, limit: int, window_seconds: int = 60) -> None:
    window = int(time.time() // window_seconds)
    full_key = f"rl:{key}:{window}"
    try:
        count = await redis.incr(full_key)
        if count == 1:
            await redis.expire(full_key, window_seconds)
    except RedisError:
        log.warning("Rate limiter unavailable, allowing request", extra={"key": key})
        return
    if count > limit:
        retry_after = window_seconds - int(time.time() % window_seconds)
        raise RateLimited(retry_after=max(retry_after, 1))


def email_key(email: str) -> str:
    """Hash emails so raw addresses don't sit in Redis keys."""
    return hashlib.sha256(email.lower().encode()).hexdigest()[:32]
