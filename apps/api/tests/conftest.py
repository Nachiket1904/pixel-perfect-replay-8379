import os

# Point the app at the test database BEFORE app modules are imported (the engine is created at import).
os.environ["DATABASE_URL"] = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://padhlo:padhlo@localhost:5432/padhlo_test"
)
os.environ["ENV"] = "test"
os.environ.setdefault("JWT_SECRET", "dev-only-test-secret-that-is-long-enough-123")
os.environ["CORS_ORIGINS"] = '["http://localhost:8080"]'

from collections.abc import AsyncIterator  # noqa: E402

import pytest  # noqa: E402
from fakeredis import FakeAsyncRedis  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import models  # noqa: E402,F401
from app.core.db import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
async def _schema() -> AsyncIterator[None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


@pytest.fixture(autouse=True)
async def _clean_tables() -> AsyncIterator[None]:
    yield
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE refresh_tokens, users RESTART IDENTITY CASCADE"))


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    app.state.redis = FakeAsyncRedis(decode_responses=True)  # fresh limiter state per test
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


USER = {"email": "Asha@Example.com", "password": "correct horse battery", "name": "Asha"}


@pytest.fixture
async def registered(client: AsyncClient) -> AsyncClient:
    r = await client.post("/api/v1/auth/register", json=USER)
    assert r.status_code == 201, r.text
    return client
