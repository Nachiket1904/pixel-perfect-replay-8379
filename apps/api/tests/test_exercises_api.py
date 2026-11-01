import pytest
from httpx import AsyncClient

from app.core.db import SessionLocal
from app.modules.roadmaps.content import RoadmapIn
from app.modules.roadmaps.seed import upsert_official
from tests.conftest import USER, roadmap_data

API = "/api/v1"

EXERCISE = {
    "title": "Double it",
    "prompt_md": "Write `double(n)`.",
    "starter_code": "def double(n):\n    pass\n",
    "solution_code": "def double(n):\n    return n * 2\n",
    "tests": [
        {"name": "doubles 2", "code": "assert double(2) == 4"},
        {"name": "doubles 0", "code": "assert double(0) == 0"},
    ],
    "hints": ["Multiply by 2."],
}


def _with_exercise(exercise: dict | None = EXERCISE) -> dict:
    data = roadmap_data()
    if exercise is not None:
        data["nodes"][1]["exercise"] = exercise  # node "b"
    return data


async def _seed(data: dict) -> None:
    async with SessionLocal() as session:
        await upsert_official(session, RoadmapIn.model_validate(data))
        await session.commit()


@pytest.fixture
async def exercise_id(client: AsyncClient) -> str:
    await _seed(_with_exercise())
    node = (await client.get(f"{API}/roadmaps/demo/nodes/b")).json()
    return node["exercise"]["id"]


PASS = {
    "code": "def double(n):\n    return n * 2\n",
    "status": "passed",
    "results": [
        {"name": "doubles 2", "passed": True},
        {"name": "doubles 0", "passed": True},
    ],
    "runtime_ms": 12,
}
FAIL = {
    "code": "def double(n):\n    return n + 2\n",
    "status": "failed",
    "results": [
        {"name": "doubles 2", "passed": True},
        {"name": "doubles 0", "passed": False, "message": "AssertionError"},
    ],
    "runtime_ms": 9,
}


def _url(exercise_id: str, suffix: str = "") -> str:
    return f"{API}/exercises/{exercise_id}/submissions{suffix}"


async def test_topic_page_shows_exercise_without_solution(client: AsyncClient, exercise_id: str):
    node = (await client.get(f"{API}/roadmaps/demo/nodes/b")).json()
    ex = node["exercise"]
    assert node["has_exercise"] is True
    assert ex["title"] == "Double it" and ex["hints_count"] == 1
    assert [t["name"] for t in ex["tests"]] == ["doubles 2", "doubles 0"]
    assert "solution_code" not in ex and "return n * 2" not in str(node)

    roadmap = (await client.get(f"{API}/roadmaps/demo")).json()
    assert {n["id"]: n["has_exercise"] for n in roadmap["nodes"]} == {"a": False, "b": True, "c": False}


async def test_submissions_require_login(client: AsyncClient, exercise_id: str):
    assert (await client.post(_url(exercise_id), json=PASS)).status_code == 401
    assert (await client.get(_url(exercise_id, "/latest"))).status_code == 401


async def test_submit_and_restore_latest(registered: AsyncClient, exercise_id: str):
    empty = (await registered.get(_url(exercise_id, "/latest"))).json()
    assert empty == {
        "latest": None,
        "attempts": 0,
        "passed_ever": False,
        "solution_unlocked": False,
        "attempts_to_unlock": 3,
    }

    r = await registered.post(_url(exercise_id), json=FAIL)
    assert r.status_code == 201, r.text
    assert r.json()["attempts"] == 1 and r.json()["passed_ever"] is False

    r = await registered.post(_url(exercise_id), json=PASS)
    body = r.json()
    assert body["attempts"] == 2 and body["passed_ever"] is True
    assert body["latest"]["status"] == "passed"
    assert body["latest"]["verified"] is False  # browser runs are never trusted

    await registered.post(_url(exercise_id), json=FAIL)  # a later failure doesn't erase the pass
    latest = (await registered.get(_url(exercise_id, "/latest"))).json()
    assert latest["latest"]["code"] == FAIL["code"]
    assert latest["passed_ever"] is True and latest["attempts"] == 3


async def test_submissions_are_per_user(registered: AsyncClient, exercise_id: str):
    await registered.post(_url(exercise_id), json=PASS)
    await registered.post(f"{API}/auth/logout")
    other = {**USER, "email": "ravi@example.com"}
    assert (await registered.post(f"{API}/auth/register", json=other)).status_code == 201
    latest = (await registered.get(_url(exercise_id, "/latest"))).json()
    assert latest == {
        "latest": None,
        "attempts": 0,
        "passed_ever": False,
        "solution_unlocked": False,
        "attempts_to_unlock": 3,
    }


@pytest.mark.parametrize(
    ("body", "why"),
    [
        ({**PASS, "results": PASS["results"][:1]}, "passed without every test"),
        ({**PASS, "results": [PASS["results"][0], FAIL["results"][1]]}, "passed with a failure"),
        ({**FAIL, "results": PASS["results"]}, "failed with no failing test"),
        ({**PASS, "results": [*PASS["results"], {"name": "made up", "passed": True}]}, "unknown test"),
        ({**PASS, "results": [PASS["results"][0], PASS["results"][0]]}, "duplicate results"),
        ({**PASS, "status": "cheated"}, "bad status"),
        ({**PASS, "verified": True}, "client can't claim verified"),
        ({**PASS, "code": "x" * 20_001}, "code too long"),
        ({**PASS, "runtime_ms": -1}, "negative runtime"),
    ],
)
async def test_inconsistent_reports_are_rejected(
    registered: AsyncClient, exercise_id: str, body: dict, why: str
):
    r = await registered.post(_url(exercise_id), json=body)
    assert r.status_code == 422, why


async def test_error_submission_needs_no_results(registered: AsyncClient, exercise_id: str):
    body = {"code": "def double(:", "status": "error", "error": "SyntaxError", "runtime_ms": 1}
    r = await registered.post(_url(exercise_id), json=body)
    assert r.status_code == 201
    assert r.json()["latest"]["error"] == "SyntaxError"


async def test_unknown_exercise_is_404(registered: AsyncClient, seeded: None):
    r = await registered.post(_url("00000000-0000-0000-0000-000000000000"), json=PASS)
    assert r.status_code == 404
    assert (await registered.post(_url("not-a-uuid"), json=PASS)).status_code == 422


async def test_old_submissions_are_pruned(registered: AsyncClient, exercise_id: str, monkeypatch):
    from app.core import ratelimit
    from app.modules.exercises import service

    async def no_limit(*args, **kwargs):  # noqa: ANN002, ANN003, ANN202
        return None

    monkeypatch.setattr(ratelimit, "hit", no_limit)
    monkeypatch.setattr(service, "KEEP_PER_EXERCISE", 3)
    for _ in range(5):
        await registered.post(_url(exercise_id), json=FAIL)
    assert (await registered.get(_url(exercise_id, "/latest"))).json()["attempts"] == 3


async def test_submissions_are_rate_limited(registered: AsyncClient, exercise_id: str):
    for _ in range(20):
        assert (await registered.post(_url(exercise_id), json=FAIL)).status_code == 201
    assert (await registered.post(_url(exercise_id), json=FAIL)).status_code == 429


async def test_reseeding_keeps_submissions_and_removal_deletes(registered: AsyncClient, exercise_id: str):
    await registered.post(_url(exercise_id), json=PASS)
    edited = {**EXERCISE, "title": "Double it (v2)"}
    await _seed(_with_exercise(edited))
    node = (await registered.get(f"{API}/roadmaps/demo/nodes/b")).json()
    assert node["exercise"]["id"] == exercise_id  # same row, history kept
    assert node["exercise"]["title"] == "Double it (v2)"
    assert (await registered.get(_url(exercise_id, "/latest"))).json()["attempts"] == 1

    await _seed(_with_exercise(None))
    node = (await registered.get(f"{API}/roadmaps/demo/nodes/b")).json()
    assert node["exercise"] is None and node["has_exercise"] is False


def test_exercise_file_must_match_a_node(tmp_path):
    import json

    from app.modules.roadmaps.content import load_roadmap_dir

    d = tmp_path / "demo"
    (d / "exercises").mkdir(parents=True)
    (d / "roadmap.json").write_text(json.dumps(roadmap_data()))
    (d / "exercises" / "zzz.json").write_text(json.dumps(EXERCISE))
    with pytest.raises(ValueError, match="no node"):
        load_roadmap_dir(d)


# ---------- Day 18: hints, solution after 3 attempts, solving finishes the topic ----------


async def test_hints_are_revealed_one_by_one_even_when_logged_out(client: AsyncClient, exercise_id: str):
    r = await client.get(f"{API}/exercises/{exercise_id}/hints/1")
    assert r.status_code == 200, r.text
    assert r.json() == {"index": 1, "total": 1, "text": "Multiply by 2."}
    assert (await client.get(f"{API}/exercises/{exercise_id}/hints/2")).status_code == 404
    assert (await client.get(f"{API}/exercises/{exercise_id}/hints/0")).status_code == 422


async def test_solution_needs_login(client: AsyncClient, exercise_id: str):
    r = await client.get(f"{API}/exercises/{exercise_id}/solution")
    assert r.status_code == 401


async def test_solution_unlocks_after_three_attempts(registered: AsyncClient, exercise_id: str):
    solution_url = f"{API}/exercises/{exercise_id}/solution"
    for attempt in range(1, 4):
        r = await registered.get(solution_url)
        assert r.status_code == 403, r.text
        assert r.json()["error"]["details"] == {"attempts": attempt - 1, "attempts_to_unlock": 3}
        summary = (await registered.post(_url(exercise_id), json=FAIL)).json()
        assert summary["solution_unlocked"] is (attempt == 3)
    r = await registered.get(solution_url)
    assert r.status_code == 200
    assert r.json() == {"solution_code": EXERCISE["solution_code"]}


async def test_solving_unlocks_solution_and_marks_topic_done(registered: AsyncClient, exercise_id: str):
    summary = (await registered.post(_url(exercise_id), json=PASS)).json()
    assert summary["passed_ever"] is True and summary["solution_unlocked"] is True
    assert (await registered.get(f"{API}/exercises/{exercise_id}/solution")).status_code == 200

    node = (await registered.get(f"{API}/roadmaps/demo/nodes/b")).json()
    assert node["status"] == "done"
    roadmap = (await registered.get(f"{API}/roadmaps/demo")).json()
    assert roadmap["progress"] == {"done": 1, "total": 3}


async def test_failed_attempt_does_not_change_topic_status(registered: AsyncClient, exercise_id: str):
    await registered.post(_url(exercise_id), json=FAIL)
    node = (await registered.get(f"{API}/roadmaps/demo/nodes/b")).json()
    assert node["status"] == "not_started"
