"""Day 20: daily quota, attempt limit, one-at-a-time lock, global spend cap."""

import pytest
from httpx import AsyncClient
from redis.exceptions import RedisError

from app.core.config import get_settings
from app.main import app
from app.modules.generator.limits import _spend_key
from app.modules.generator.llm import get_llm
from tests.test_generator_api import BODY, Scripted, good_output

API = "/api/v1"
NON_TECH = {"is_tech_goal": False, "title": "x", "description": "", "nodes": [], "edges": []}


@pytest.fixture
def llm():  # noqa: ANN201
    holder = {"client": Scripted(*[good_output() for _ in range(10)])}
    app.dependency_overrides[get_llm] = lambda: holder["client"]
    yield holder
    app.dependency_overrides.pop(get_llm, None)


async def test_quota_needs_login(client: AsyncClient):
    assert (await client.get(f"{API}/generator/quota")).status_code == 401


async def test_three_roadmaps_per_day(registered: AsyncClient, llm):  # noqa: ANN001
    q = (await registered.get(f"{API}/generator/quota")).json()
    assert q["remaining"] == 3 and q["limit"] == 3 and q["resets_at"].endswith("+05:30")
    for left in (2, 1, 0):
        assert (await registered.post(f"{API}/generator/roadmaps", json=BODY)).status_code == 201
        assert (await registered.get(f"{API}/generator/quota")).json()["remaining"] == left
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 429 and r.json()["error"]["code"] == "RATE_LIMITED"
    assert r.json()["error"]["details"]["limit"] == 3
    assert len(llm["client"].prompts) == 3  # the 4th never reached the LLM


async def test_rejected_goals_dont_use_quota_but_are_capped(registered: AsyncClient, llm):  # noqa: ANN001
    llm["client"] = Scripted(*[NON_TECH] * 20)
    for _ in range(8):
        r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
        assert r.json()["error"]["code"] == "NON_TECH_GOAL"
    assert (await registered.get(f"{API}/generator/quota")).json()["remaining"] == 3
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 429  # 9th attempt today
    assert len(llm["client"].prompts) == 8


async def test_spend_is_recorded_and_capped(registered: AsyncClient, llm):  # noqa: ANN001
    redis = app.state.redis
    assert (await registered.post(f"{API}/generator/roadmaps", json=BODY)).status_code == 201
    # Scripted usage: 1000 in, 2000 out at $0.10 / $0.50 per MTok = $0.0011
    assert float(await redis.get(_spend_key())) == pytest.approx(0.0011)

    await redis.set(_spend_key(), get_settings().llm_daily_budget_usd)
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 503 and r.json()["error"]["code"] == "GENERATOR_UNAVAILABLE"
    assert len(llm["client"].prompts) == 1


async def test_spend_cap_fails_closed_when_redis_is_down(registered: AsyncClient, llm, monkeypatch):  # noqa: ANN001
    async def broken(*_a, **_k):  # noqa: ANN002, ANN003, ANN202
        raise RedisError("down")

    monkeypatch.setattr(app.state.redis, "get", broken)
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 503
    assert llm["client"].prompts == []


async def test_one_generation_at_a_time(registered: AsyncClient, llm):  # noqa: ANN001
    me = (await registered.get(f"{API}/users/me")).json()
    await app.state.redis.set(f"gen-lock:{me['id']}", "1")
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 409 and r.json()["error"]["code"] == "CONFLICT"


async def test_lock_is_released_after_a_failure(registered: AsyncClient, llm):  # noqa: ANN001
    bad = good_output(n=2)
    llm["client"] = Scripted(bad, bad, good_output())
    assert (await registered.post(f"{API}/generator/roadmaps", json=BODY)).status_code == 502
    assert (await registered.post(f"{API}/generator/roadmaps", json=BODY)).status_code == 201
