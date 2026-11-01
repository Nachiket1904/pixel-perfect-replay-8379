"""Day 19: AI roadmap generator (validation, saving, official matches, privacy)."""

import copy

import pytest
from httpx import AsyncClient

from app.core.db import SessionLocal
from app.main import app
from app.modules.generator.llm import LLMResult, LLMUnavailable, get_llm
from app.modules.generator.service import layout
from app.modules.roadmaps.content import RoadmapIn
from app.modules.roadmaps.seed import upsert_official
from tests.conftest import USER, roadmap_data

API = "/api/v1"
BODY = {
    "goal": "I want to become an ML engineer, I know basic Python",
    "level": "beginner",
    "hours_per_week": 6,
}


def good_output(n: int = 8, **overrides) -> dict:  # noqa: ANN003
    nodes = [
        {
            "key": f"topic-{i}",
            "title": f"Topic {i}",
            "summary": f"Learn topic number {i} properly.",
            "search_query": f"topic {i} tutorial",
            "estimated_hours": 3,
            "official_match": "",
        }
        for i in range(n)
    ]
    edges = [{"from": f"topic-{i}", "to": f"topic-{i + 1}"} for i in range(n - 1)]
    data = {"is_tech_goal": True, "title": "ML Engineer path", "description": "Your path.", "nodes": nodes,
            "edges": edges}  # fmt: skip
    data.update(overrides)
    return data


class Scripted:
    """Returns the queued outputs in order and records prompts."""

    def __init__(self, *outputs) -> None:  # noqa: ANN002
        self.outputs = list(outputs)
        self.prompts: list[str] = []

    async def generate(self, system: str, user: str) -> LLMResult:
        self.prompts.append(user)
        out = self.outputs.pop(0)
        if isinstance(out, Exception):
            raise out
        return LLMResult(data=copy.deepcopy(out), input_tokens=1000, output_tokens=2000)


@pytest.fixture
def llm():  # noqa: ANN201
    holder = {"client": Scripted(good_output())}
    app.dependency_overrides[get_llm] = lambda: holder["client"]
    yield holder
    app.dependency_overrides.pop(get_llm, None)


async def test_requires_login(client: AsyncClient, llm):  # noqa: ANN001
    r = await client.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 401


async def test_generates_private_roadmap(registered: AsyncClient, llm):  # noqa: ANN001
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 201, r.text
    rm = r.json()
    assert rm["source"] == "ai" and rm["goal_prompt"] == BODY["goal"]
    assert rm["slug"].startswith("ml-engineer-path-")
    assert len(rm["nodes"]) == 8 and len(rm["edges"]) == 7
    assert rm["estimated_hours"] == 24

    # Listed under "mine", topic pages work, and links were built by us (no model URLs).
    mine = (await registered.get(f"{API}/roadmaps?filter=mine")).json()
    assert [m["slug"] for m in mine] == [rm["slug"]]
    node = (await registered.get(f"{API}/roadmaps/{rm['slug']}/nodes/topic-0")).json()
    assert node["roadmap_source"] == "ai"
    assert all(res["url"].startswith("https://") for res in node["resources"])
    assert any("youtube.com/results" in res["url"] for res in node["resources"])

    # Private: other users and anonymous visitors get 404.
    await registered.post(f"{API}/auth/logout")
    assert (await registered.get(f"{API}/roadmaps/{rm['slug']}")).status_code == 404
    await registered.post(f"{API}/auth/register", json={**USER, "email": "ravi@example.com"})
    assert (await registered.get(f"{API}/roadmaps/{rm['slug']}")).status_code == 404


async def test_official_match_reuses_written_content(registered: AsyncClient, llm):  # noqa: ANN001
    async with SessionLocal() as session:
        await upsert_official(session, RoadmapIn.model_validate(roadmap_data()))
        await session.commit()
    out = good_output()
    out["nodes"][0]["official_match"] = "b"  # demo node "b" has a docs resource
    out["nodes"][1]["official_match"] = "does-not-exist"  # ignored, not an error
    llm["client"] = Scripted(out)
    rm = (await registered.post(f"{API}/generator/roadmaps", json=BODY)).json()
    first = (await registered.get(f"{API}/roadmaps/{rm['slug']}/nodes/topic-0")).json()
    assert [res["url"] for res in first["resources"]] == ["https://example.com/b"]
    assert "Official topics you may match:\n- a: A\n- b: B\n- c: C" in llm["client"].prompts[0]


@pytest.mark.parametrize(
    ("bad", "why"),
    [
        (good_output(n=5), "too few topics"),
        (good_output(n=31), "too many topics"),
        (
            good_output(edges=[{"from": "topic-0", "to": "topic-1"}, {"from": "topic-1", "to": "topic-0"}]),
            "cycle",
        ),
        (good_output(edges=[{"from": "topic-0", "to": "nope"}]), "unknown node"),
        (good_output(title="See https://evil.example"), "url in title"),
        (good_output(description="<img src=x onerror=alert(1)>"), "html"),
        ({"nonsense": True}, "wrong shape"),
        (None, "not json"),
    ],
)
async def test_invalid_output_is_retried_once_then_fails(registered: AsyncClient, llm, bad, why):  # noqa: ANN001
    llm["client"] = Scripted(bad, bad)
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 502, why
    assert r.json()["error"]["code"] == "GENERATION_FAILED"
    assert "rejected by validation" in llm["client"].prompts[1]
    assert (await registered.get(f"{API}/roadmaps?filter=mine")).json() == []


async def test_retry_can_recover(registered: AsyncClient, llm):  # noqa: ANN001
    llm["client"] = Scripted(good_output(n=3), good_output())
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 201


async def test_url_in_summary_is_rejected(registered: AsyncClient, llm):  # noqa: ANN001
    out = good_output()
    out["nodes"][2]["summary"] = "Read [this](javascript:alert(1)) first."
    llm["client"] = Scripted(out, out)
    assert (await registered.post(f"{API}/generator/roadmaps", json=BODY)).status_code == 502


async def test_non_tech_goal(registered: AsyncClient, llm):  # noqa: ANN001
    llm["client"] = Scripted(
        {"is_tech_goal": False, "title": "x", "description": "", "nodes": [], "edges": []}
    )
    r = await registered.post(f"{API}/generator/roadmaps", json={**BODY, "goal": "teach me to bake a cake"})
    assert r.status_code == 422 and r.json()["error"]["code"] == "NON_TECH_GOAL"


async def test_provider_down_is_503(registered: AsyncClient, llm):  # noqa: ANN001
    llm["client"] = Scripted(LLMUnavailable("down"))
    r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
    assert r.status_code == 503 and r.json()["error"]["code"] == "GENERATOR_UNAVAILABLE"


@pytest.mark.parametrize(
    "body",
    [
        {**BODY, "goal": "too short"},
        {**BODY, "goal": "x" * 301},
        {**BODY, "level": "guru"},
        {**BODY, "hours_per_week": 0},
        {**BODY, "extra": 1},
    ],
)
async def test_request_is_validated(registered: AsyncClient, llm, body):  # noqa: ANN001
    assert (await registered.post(f"{API}/generator/roadmaps", json=body)).status_code == 422


async def test_fake_provider_works_end_to_end(registered: AsyncClient):
    from app.modules.generator.llm import FakeClient

    app.dependency_overrides[get_llm] = FakeClient
    try:
        r = await registered.post(f"{API}/generator/roadmaps", json=BODY)
        assert r.status_code == 201, r.text
        bad = await registered.post(
            f"{API}/generator/roadmaps", json={**BODY, "goal": "learn to cook biryani"}
        )
        assert bad.json()["error"]["code"] == "NON_TECH_GOAL"
    finally:
        app.dependency_overrides.pop(get_llm, None)


def test_layout_rows_follow_prerequisites():
    pos = layout(["a", "b", "c", "d"], {("a", "b"), ("a", "c"), ("b", "d"), ("c", "d")})
    assert pos["a"][1] == 0 and pos["b"][1] == pos["c"][1] == 120 and pos["d"][1] == 240
    assert pos["b"][0] == -pos["c"][0]  # row is centred


# ---------- AnthropicClient request/response handling (no network) ----------


def _anthropic(monkeypatch, status_code: int, payload: dict):  # noqa: ANN001, ANN202
    import httpx
    from pydantic import SecretStr

    from app.core.config import get_settings
    from app.modules.generator.llm import AnthropicClient

    sent = {}

    async def fake_post(self, url, json, headers):  # noqa: ANN001, ANN202, A002
        sent.update(url=url, json=json, headers=headers)
        return httpx.Response(status_code, json=payload)

    monkeypatch.setattr(httpx.AsyncClient, "post", fake_post)
    settings = get_settings().model_copy(update={"anthropic_api_key": SecretStr("sk-test")})
    return AnthropicClient(settings), sent


async def test_anthropic_client_sends_structured_output_request(monkeypatch):
    out = good_output()
    payload = {
        "content": [
            {"type": "thinking", "thinking": "..."},
            {"type": "text", "text": __import__("json").dumps(out)},
        ],
        "stop_reason": "end_turn",
        "usage": {"input_tokens": 1200, "output_tokens": 3400},
    }
    client, sent = _anthropic(monkeypatch, 200, payload)
    result = await client.generate("sys", "Goal: x")
    assert result.data == out and (result.input_tokens, result.output_tokens) == (1200, 3400)
    assert sent["url"] == "https://api.anthropic.com/v1/messages"
    assert sent["headers"]["x-api-key"] == "sk-test"
    assert sent["json"]["model"] == "claude-haiku-5-5"
    assert sent["json"]["output_config"]["format"]["type"] == "json_schema"
    assert sent["json"]["messages"][-1]["role"] == "user"  # no assistant prefill
    assert "temperature" not in sent["json"]


async def test_anthropic_client_maps_errors(monkeypatch):
    from app.modules.generator.llm import LLMRefused

    client, _ = _anthropic(monkeypatch, 529, {"error": {"type": "overloaded_error"}})
    with pytest.raises(LLMUnavailable):
        await client.generate("sys", "Goal: x")
    client, _ = _anthropic(monkeypatch, 200, {"content": [], "stop_reason": "refusal", "usage": {}})
    with pytest.raises(LLMRefused):
        await client.generate("sys", "Goal: x")
    client, _ = _anthropic(
        monkeypatch, 200, {"content": [{"type": "text", "text": '{"cut'}], "stop_reason": "max_tokens"}
    )
    assert (await client.generate("sys", "Goal: x")).data is None  # treated as invalid output
