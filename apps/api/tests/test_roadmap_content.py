import json

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.core.db import SessionLocal
from app.modules.roadmaps.content import RoadmapIn, load_roadmap_dir
from app.modules.roadmaps.models import Roadmap, RoadmapEdge
from app.modules.roadmaps.seed import DEFAULT_CONTENT_DIR, discover, upsert_official
from tests.conftest import roadmap_data


def test_valid_roadmap_parses() -> None:
    r = RoadmapIn.model_validate(roadmap_data())
    assert [n.key for n in r.nodes] == ["a", "b", "c"]


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"edges": [{"from": "a", "to": "zzz"}]}, "unknown node"),
        ({"edges": [{"from": "a", "to": "a"}]}, "itself"),
        ({"edges": [{"from": "a", "to": "b"}, {"from": "b", "to": "a"}]}, "cycle"),
        ({"edges": [{"from": "a", "to": "b"}, {"from": "a", "to": "b"}]}, "Duplicate edge"),
        ({"nodes": [{"key": "a", "title": "A"}, {"key": "a", "title": "A2"}], "edges": []}, "Duplicate node"),
        ({"slug": "Bad Slug"}, "slug"),
    ],
)
def test_invalid_graphs_are_rejected(overrides: dict, message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        RoadmapIn.model_validate(roadmap_data(**overrides))


@pytest.mark.parametrize("url", ["javascript:alert(1)", "http://example.com", "not a url"])
def test_resource_links_must_be_https(url: str) -> None:
    data = roadmap_data()
    data["nodes"][1]["resources"] = [{"title": "x", "url": url, "kind": "docs"}]
    with pytest.raises(ValidationError):
        RoadmapIn.model_validate(data)


def test_markdown_files_are_loaded(tmp_path) -> None:  # noqa: ANN001
    folder = tmp_path / "demo"
    (folder / "nodes").mkdir(parents=True)
    data = roadmap_data()
    del data["nodes"][0]["content_md"]
    (folder / "roadmap.json").write_text(json.dumps(data))
    (folder / "nodes" / "a.md").write_text("## From a file\n")
    assert load_roadmap_dir(folder).nodes[0].content_md == "## From a file"


def test_repo_content_is_valid() -> None:
    """The real files in packages/content must always pass validation (also run in CI)."""
    slugs = [r.slug for r in discover(DEFAULT_CONTENT_DIR)]
    assert "python-for-ml" in slugs


async def _load(slug: str) -> Roadmap:
    async with SessionLocal() as session:
        roadmap = await session.scalar(
            select(Roadmap)
            .where(Roadmap.slug == slug)
            .options(selectinload(Roadmap.nodes), selectinload(Roadmap.edges))
        )
        assert roadmap is not None
        return roadmap


async def test_seed_is_idempotent_and_keeps_node_ids(seeded: None) -> None:
    before = {n.key: n.id for n in (await _load("demo")).nodes}

    # Edit a title, drop node c, and re-seed.
    data = roadmap_data()
    data["nodes"][0]["title"] = "A renamed"
    data["nodes"] = data["nodes"][:2]
    data["edges"] = [{"from": "a", "to": "b"}]
    async with SessionLocal() as session:
        await upsert_official(session, RoadmapIn.model_validate(data))
        await session.commit()

    after = await _load("demo")
    assert {n.key: n.id for n in after.nodes} == {"a": before["a"], "b": before["b"]}
    assert after.nodes[0].title == "A renamed"
    async with SessionLocal() as session:
        assert await session.scalar(select(func.count()).select_from(RoadmapEdge)) == 1


def test_every_official_node_has_content_and_resources() -> None:
    """Day 13: no official topic should fall back to the generic page."""
    missing = [
        f"{r.slug}/{n.key}"
        for r in discover(DEFAULT_CONTENT_DIR)
        for n in r.nodes
        if not n.content_md.strip() or not n.resources
    ]
    assert missing == []


def _run_exercise(code: str, tests: list) -> list[bool]:
    """Same idea as the browser harness, in CPython. Content is ours, so exec is fine here."""
    import contextlib
    import io

    ns: dict = {"__name__": "__main__"}
    with contextlib.redirect_stdout(io.StringIO()):
        exec(compile(code, "<code>", "exec"), ns)  # noqa: S102
        results = []
        for t in tests:
            try:
                exec(compile(t.code, f"<test {t.name}>", "exec"), ns)  # noqa: S102
                results.append(True)
            except Exception:  # noqa: BLE001
                results.append(False)
    return results


def test_every_exercise_solution_passes_and_starter_fails() -> None:
    """Day 17: a broken reference solution or an already-solved starter is a content bug."""
    checked = 0
    for r in discover(DEFAULT_CONTENT_DIR):
        for n in r.nodes:
            if n.exercise is None:
                continue
            where = f"{r.slug}/{n.key}"
            assert all(_run_exercise(n.exercise.solution_code, n.exercise.tests)), where
            assert not all(_run_exercise(n.exercise.starter_code, n.exercise.tests)), where
            checked += 1
    assert checked >= 5  # Day 18: exercises on 4+ topics
