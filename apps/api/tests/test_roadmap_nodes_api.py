from httpx import AsyncClient

from tests.conftest import USER
from tests.test_roadmaps_api import _private_ai_roadmap

API = "/api/v1/roadmaps"


async def test_topic_page_has_content_and_neighbours(client: AsyncClient, seeded: None) -> None:
    r = await client.get(f"{API}/demo/nodes/b")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "b"
    assert body["roadmap_slug"] == "demo"
    assert [n["id"] for n in body["prerequisites"]] == ["a"]
    assert [n["id"] for n in body["unlocks"]] == ["c"]
    assert body["resources"] == [
        {"title": "Docs", "url": "https://example.com/b", "kind": "docs", "is_free": True}
    ]
    assert body["exercise"] is None and body["linked_paper"] is None


async def test_written_content_is_returned(client: AsyncClient, seeded: None) -> None:
    body = (await client.get(f"{API}/demo/nodes/a")).json()
    assert body["content_md"] == "## A"
    assert body["prerequisites"] == []
    # a -> c is an optional edge; it still shows as something a unlocks.
    assert {n["id"] for n in body["unlocks"]} == {"b", "c"}


async def test_node_without_content_gets_fallback(client: AsyncClient, seeded: None) -> None:
    body = (await client.get(f"{API}/demo/nodes/c")).json()
    assert body["content_md"].startswith("## Overview")
    assert body["resources"][0]["kind"] == "search"
    assert body["resources"][0]["url"].startswith("https://www.youtube.com/results?search_query=")


async def test_unknown_node_is_404(client: AsyncClient, seeded: None) -> None:
    r = await client.get(f"{API}/demo/nodes/zzz")
    assert r.status_code == 404
    assert r.json()["error"]["code"] == "NOT_FOUND"


async def test_bad_node_key_is_rejected(client: AsyncClient, seeded: None) -> None:
    assert (await client.get(f"{API}/demo/nodes/..%2F..%2Fetc")).status_code in {404, 422}


async def test_private_roadmap_nodes_are_hidden(registered: AsyncClient) -> None:
    await _private_ai_roadmap(USER["email"])
    registered.cookies.clear()
    assert (await registered.get(f"{API}/my-goal/nodes/anything")).status_code == 404
