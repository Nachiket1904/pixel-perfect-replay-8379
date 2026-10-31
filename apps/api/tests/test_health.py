from httpx import AsyncClient

from app.core.config import normalize_database_url


async def test_health_ok(client: AsyncClient) -> None:
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "db": "ok", "redis": "ok"}
    assert r.headers["x-content-type-options"] == "nosniff"


def test_neon_style_urls_are_normalized() -> None:
    url = normalize_database_url("postgres://u:p@host.neon.tech/db?sslmode=require&channel_binding=require")
    assert url == "postgresql+asyncpg://u:p@host.neon.tech/db?ssl=require"
    assert normalize_database_url("postgresql://u:p@h/db").startswith("postgresql+asyncpg://")


async def test_unknown_route_uses_error_format(client: AsyncClient) -> None:
    r = await client.get("/api/v1/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"
