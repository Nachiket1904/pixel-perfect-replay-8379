import uuid

from httpx import AsyncClient
from sqlalchemy import select

from app.core.db import SessionLocal
from app.modules.roadmaps.models import Roadmap, RoadmapSource, Visibility
from app.modules.users.models import User
from tests.conftest import USER

API = "/api/v1/roadmaps"


async def _private_ai_roadmap(owner_email: str, slug: str = "my-goal") -> None:
    async with SessionLocal() as session:
        owner = await session.scalar(select(User).where(User.email == owner_email.lower()))
        session.add(
            Roadmap(
                slug=slug,
                title="My goal",
                source=RoadmapSource.ai,
                level="beginner",
                estimated_hours=10,
                visibility=Visibility.private,
                owner_id=owner.id if owner else None,
                goal_prompt="learn fastapi",
            )
        )
        await session.commit()


async def test_list_is_public(client: AsyncClient, seeded: None) -> None:
    r = await client.get(API)
    assert r.status_code == 200
    [demo] = r.json()
    assert demo["slug"] == "demo"
    assert demo["node_count"] == 3
    assert demo["source"] == "official"
    assert demo["progress"] is None


async def test_get_roadmap_returns_graph_with_node_keys(client: AsyncClient, seeded: None) -> None:
    r = await client.get(f"{API}/demo")
    assert r.status_code == 200
    body = r.json()
    assert [n["id"] for n in body["nodes"]] == ["a", "b", "c"]
    assert body["nodes"][1]["position"] == {"x": 0, "y": 120}
    assert {(e["from_node_id"], e["to_node_id"], e["kind"]) for e in body["edges"]} == {
        ("a", "b", "prerequisite"),
        ("b", "c", "prerequisite"),
        ("a", "c", "optional"),
    }
    # Long content is not sent with the graph; the topic endpoint (Day 10) serves it.
    assert "content_md" not in body["nodes"][0]


async def test_unknown_roadmap_is_404(client: AsyncClient) -> None:
    r = await client.get(f"{API}/nope")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


async def test_bad_slug_is_rejected(client: AsyncClient) -> None:
    r = await client.get(f"{API}/Not%20A%20Slug")
    assert r.status_code == 422


async def test_private_roadmaps_are_only_visible_to_their_owner(
    registered: AsyncClient, seeded: None
) -> None:
    await _private_ai_roadmap(USER["email"])

    mine = await registered.get(API, params={"filter": "mine"})
    assert [r["slug"] for r in mine.json()] == ["my-goal"]
    assert (await registered.get(f"{API}/my-goal")).status_code == 200

    # A logged-out visitor can't list or open it (and gets 404, not 403).
    registered.cookies.clear()
    assert [r["slug"] for r in (await registered.get(API)).json()] == ["demo"]
    assert (await registered.get(API, params={"filter": "mine"})).json() == []
    assert (await registered.get(f"{API}/my-goal")).status_code == 404


async def test_official_filter(registered: AsyncClient, seeded: None) -> None:
    await _private_ai_roadmap(USER["email"])
    r = await registered.get(API, params={"filter": "official"})
    assert [x["slug"] for x in r.json()] == ["demo"]


async def test_expired_access_cookie_gets_401_so_client_refreshes(client: AsyncClient, seeded: None) -> None:
    client.cookies.set("access_token", "not-a-valid-jwt")
    r = await client.get(API)
    assert r.status_code == 401


async def test_ids_are_uuids(client: AsyncClient, seeded: None) -> None:
    body = (await client.get(f"{API}/demo")).json()
    uuid.UUID(body["id"])
