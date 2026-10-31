from fastapi import Request
from redis.asyncio import Redis


def create_redis(url: str) -> Redis:
    return Redis.from_url(url, decode_responses=True, socket_timeout=2, socket_connect_timeout=2)


def get_redis(request: Request) -> Redis:
    return request.app.state.redis
