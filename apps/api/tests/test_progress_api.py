from datetime import datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import SessionLocal
from app.modules.progress.service import TZ
from app.modules.users.models import User
from tests.conftest import USER
from tests.test_roadmaps_api import _private_ai_roadmap

API = "/api/v1"


async def _set(client: AsyncClient, key: str, status: str, slug: str = "demo"):  # noqa: ANN202
    return await client.put(f"{API}/roadmaps/{slug}/nodes/{key}/progress", json={"status": status})


async def test_progress_requires_login(client: AsyncClient, seeded: None) -> None:
    r = await _set(client, "a", "done")
    assert r.status_code == 401


async def test_mark_done_shows_everywhere(registered: AsyncClient, seeded: None) -> None:
    r = await _set(registered, "a", "done")
    assert r.status_code == 200, r.text
    assert r.json() == {"node_id": "a", "status": "done", "done": 1, "total": 3}

    roadmap = (await registered.get(f"{API}/roadmaps/demo")).json()
    assert {n["id"]: n["status"] for n in roadmap["nodes"]} == {
        "a": "done",
        "b": "not_started",
        "c": "not_started",
    }
    assert roadmap["progress"] == {"done": 1, "total": 3}

    [summary] = (await registered.get(f"{API}/roadmaps")).json()
    assert summary["progress"] == {"done": 1, "total": 3}

    node_b = (await registered.get(f"{API}/roadmaps/demo/nodes/b")).json()
    assert node_b["prerequisites"] == [{"id": "a", "title": "A", "status": "done"}]


async def test_status_change_is_idempotent_and_reset_deletes(registered: AsyncClient, seeded: None) -> None:
    await _set(registered, "b", "in_progress")
    await _set(registered, "b", "in_progress")
    r = await _set(registered, "b", "done")
    assert r.json()["done"] == 1
    r = await _set(registered, "b", "not_started")
    assert r.json() == {"node_id": "b", "status": "not_started", "done": 0, "total": 3}
    # Started earlier, nothing left: the summary goes back to "not started" (null).
    [summary] = (await registered.get(f"{API}/roadmaps")).json()
    assert summary["progress"] is None


async def test_progress_is_per_user(registered: AsyncClient, seeded: None) -> None:
    await _set(registered, "a", "done")
    await registered.post(f"{API}/auth/logout")
    other = {**USER, "email": "ravi@example.com"}
    assert (await registered.post(f"{API}/auth/register", json=other)).status_code == 201
    roadmap = (await registered.get(f"{API}/roadmaps/demo")).json()
    assert all(n["status"] == "not_started" for n in roadmap["nodes"])
    assert roadmap["progress"] is None


async def test_anonymous_sees_no_progress(client: AsyncClient, seeded: None) -> None:
    roadmap = (await client.get(f"{API}/roadmaps/demo")).json()
    assert roadmap["progress"] is None


async def test_bad_status_and_unknown_node(registered: AsyncClient, seeded: None) -> None:
    assert (await _set(registered, "a", "finished")).status_code == 422
    r = await registered.put(f"{API}/roadmaps/demo/nodes/a/progress", json={"status": "done", "xp": 9999})
    assert r.status_code == 422  # extra fields are rejected
    assert (await _set(registered, "zzz", "done")).status_code == 404
    assert (await _set(registered, "a", "done", slug="nope")).status_code == 404


async def test_cannot_track_someone_elses_private_roadmap(registered: AsyncClient, seeded: None) -> None:
    await _private_ai_roadmap("someone@else.com", slug="secret")
    assert (await _set(registered, "a", "done", slug="secret")).status_code == 404


async def test_progress_is_rate_limited(registered: AsyncClient, seeded: None) -> None:
    for _ in range(60):
        assert (await _set(registered, "a", "in_progress")).status_code == 200
    assert (await _set(registered, "a", "done")).status_code == 429


# ---------- Dashboard (Day 12) ----------


async def test_dashboard_requires_login(client: AsyncClient) -> None:
    assert (await client.get(f"{API}/users/me/dashboard")).status_code == 401


async def test_dashboard_empty_for_new_user(registered: AsyncClient, seeded: None) -> None:
    body = (await registered.get(f"{API}/users/me/dashboard")).json()
    assert body["active"] == [] and body["streak_days"] == 0


async def test_dashboard_next_node_follows_prerequisites(registered: AsyncClient, seeded: None) -> None:
    await _set(registered, "a", "done")
    body = (await registered.get(f"{API}/users/me/dashboard")).json()
    [item] = body["active"]
    assert item["roadmap"]["slug"] == "demo"
    assert item["roadmap"]["progress"] == {"done": 1, "total": 3}
    assert item["next_node"] == {"id": "b", "title": "B", "status": "not_started"}
    assert body["streak_days"] == 1 and body["activity"] == "today"

    await _set(registered, "c", "in_progress")  # in-progress wins over "next ready"
    [item] = (await registered.get(f"{API}/users/me/dashboard")).json()["active"]
    assert item["next_node"]["id"] == "c"

    for key in ("b", "c"):
        await _set(registered, key, "done")
    [item] = (await registered.get(f"{API}/users/me/dashboard")).json()["active"]
    assert item["next_node"] is None


async def _set_last_active(days_ago: int, streak: int) -> None:
    async with SessionLocal() as session:
        user = await session.scalar(select(User).where(User.email == USER["email"].lower()))
        user.last_active_at = datetime.now(TZ) - timedelta(days=days_ago)
        user.streak_days = streak
        await session.commit()


async def test_streak_continues_from_yesterday(registered: AsyncClient, seeded: None) -> None:
    await _set_last_active(days_ago=1, streak=4)
    assert (await registered.get(f"{API}/users/me/dashboard")).json()["streak_days"] == 4
    await _set(registered, "a", "done")
    await _set(registered, "b", "done")  # same day: no double count
    body = (await registered.get(f"{API}/users/me/dashboard")).json()
    assert body["streak_days"] == 5 and body["activity"] == "today"


async def test_streak_resets_after_a_missed_day(registered: AsyncClient, seeded: None) -> None:
    await _set_last_active(days_ago=3, streak=9)
    body = (await registered.get(f"{API}/users/me/dashboard")).json()
    assert body["streak_days"] == 0 and body["activity"] == "lapsed"
    await _set(registered, "a", "done")
    assert (await registered.get(f"{API}/users/me/dashboard")).json()["streak_days"] == 1
