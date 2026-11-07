import uuid

import pytest

from app.modules.github.service import build_rows, parse_repo_url


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("https://github.com/pallets/flask", ("pallets", "flask")),
        ("github.com/Pallets/Flask.git", ("pallets", "flask")),
        ("https://github.com/fastapi/fastapi/tree/master/docs", ("fastapi", "fastapi")),
        ("https://www.github.com/a-b/c.d_e?tab=readme", ("a-b", "c.d_e")),
        ("  owner/repo  ", ("owner", "repo")),
    ],
)
def test_parse_valid(raw, expected):
    assert parse_repo_url(raw) == expected


@pytest.mark.parametrize(
    "raw",
    [
        "https://gitlab.com/a/b",
        "https://github.com/onlyowner",
        "http://169.254.169.254/latest/meta-data",
        "https://github.com.evil.com/a/b",
        "https://github.com/../etc",
        "javascript:alert(1)",
        "ftp://github.com/a/b",
    ],
)
def test_parse_rejects(raw):
    with pytest.raises(ValueError):
        parse_repo_url(raw)


def _commit(sha, parents, date="2026-01-01T00:00:00Z"):
    return {
        "sha": sha,
        "commit": {"message": f"msg {sha}", "author": {"name": "A"}, "committer": {"date": date}},
        "author": {"login": "a"},
        "parents": [{"sha": p} for p in parents],
    }


def test_build_rows_dedupes_commits_and_dates_tags():
    repo_id = uuid.uuid4()
    data = {
        "meta": {"default_branch": "main"},
        "branches": [{"name": "dev", "commit": {"sha": "c3"}}],  # main missing: >100 branches case
        "tags": [
            {"name": "v1", "commit": {"sha": "c1"}},
            {"name": "v2", "commit": {"sha": "c2"}},
        ],
        "releases": [{"tag_name": "v2", "published_at": "2026-03-01T00:00:00Z"}],
        "main_commits": [_commit("c2", ["c1"]), _commit("c1", [], "2026-02-01T00:00:00Z")],
        "other_commits": [[_commit("c3", ["c2"]), _commit("c2", ["c1"])]],
    }
    rows = build_rows(repo_id, data)

    assert sorted(c["sha"] for c in rows["commits"]) == ["c1", "c2", "c3"]
    assert {b["name"]: b["is_default"] for b in rows["branches"]} == {"dev": False, "main": True}
    tags = {t["name"]: t["released_at"].isoformat() for t in rows["tags"]}
    assert tags["v2"].startswith("2026-03-01")  # release date wins
    assert tags["v1"].startswith("2026-02-01")  # falls back to the commit date
