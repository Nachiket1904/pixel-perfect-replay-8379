import asyncio
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.github.client import GitHubClient, GitHubError
from app.modules.github.config import gh_settings
from app.modules.github.deps import SessionLocal
from app.modules.github.models import Repo, RepoBranch, RepoCommit, RepoTag

log = logging.getLogger(__name__)

OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")

_redis: Redis | None = None


def _get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(gh_settings.redis_url)
    return _redis


def parse_repo_url(raw: str) -> tuple[str, str]:
    """Accepts https://github.com/owner/name[/...], github.com/owner/name, or owner/name.

    Returns lowercased (owner, name). Anything that isn't github.com is rejected, so the
    server only ever talks to api.github.com (no SSRF).
    """
    s = raw.strip()
    if "://" in s or s.lower().startswith(("github.com", "www.github.com")):
        if "://" not in s:
            s = "https://" + s
        u = urlparse(s)
        if u.scheme not in ("http", "https") or u.hostname not in ("github.com", "www.github.com"):
            raise ValueError("Only github.com repository URLs are supported.")
        path = u.path
    else:
        path = s
    parts = [p for p in path.split("/") if p]
    if len(parts) < 2:
        raise ValueError("Use a URL like https://github.com/owner/repo.")
    owner, name = parts[0], parts[1].removesuffix(".git")
    if not OWNER_RE.match(owner) or not NAME_RE.match(name) or name in (".", ".."):
        raise ValueError("That doesn't look like a valid GitHub repository.")
    return owner.lower(), name.lower()


def needs_sync(repo: Repo) -> bool:
    now = datetime.now(timezone.utc)
    if repo.sync_status in ("pending", "syncing"):
        return repo.updated_at < now - timedelta(minutes=10)  # only if the job looks stuck
    if repo.sync_status == "ok" and repo.last_synced_at:
        return repo.last_synced_at < now - timedelta(minutes=gh_settings.github_sync_ttl_minutes)
    return True  # failed or never synced


async def check_analyze_limit(user_id: object) -> None:
    key = f"rl:repo-analyze:{user_id}"
    redis = _get_redis()
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, 3600)
    if count > gh_settings.github_analyze_limit_per_hour:
        raise HTTPException(status_code=429, detail="Too many repository analyses. Try again in an hour.")


def _dt(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if value else None


def commit_row(repo_id: uuid.UUID, c: dict) -> dict:
    info = c.get("commit") or {}
    return {
        "id": uuid.uuid4(),
        "repo_id": repo_id,
        "sha": c["sha"],
        "message": (info.get("message") or "")[:1000],
        "author_name": ((info.get("author") or {}).get("name") or "unknown")[:255],
        "author_login": (c.get("author") or {}).get("login"),
        "committed_at": _dt((info.get("committer") or {}).get("date")) or datetime.now(timezone.utc),
        "parent_shas": [p["sha"] for p in c.get("parents", [])],
    }


async def fetch_repo_data(owner: str, name: str) -> dict:
    """All GitHub calls for one analysis (about 15-20 requests). No DB access."""
    token = gh_settings.github_token.get_secret_value() if gh_settings.github_token else None
    async with GitHubClient(token) as gh:
        meta = await gh.repo(owner, name)
        default = meta["default_branch"]
        branches, tags, releases, main_commits = await asyncio.gather(
            gh.branches(owner, name),
            gh.tags(owner, name),
            gh.releases(owner, name),
            gh.commits(owner, name, default, gh_settings.github_max_commits),
        )
        others = [b for b in branches if b["name"] != default][: gh_settings.github_max_branches]
        other_commits = await asyncio.gather(
            *(gh.commits(owner, name, b["name"], gh_settings.github_branch_commits) for b in others)
        )
    return {
        "meta": meta,
        "branches": branches,
        "tags": tags,
        "releases": releases,
        "main_commits": main_commits,
        "other_commits": list(other_commits),
    }


def build_rows(repo_id: uuid.UUID, data: dict) -> dict:
    """Turns raw GitHub JSON into DB rows. Pure function, easy to test."""
    meta, main_commits = data["meta"], data["main_commits"]
    commits: dict[str, dict] = {}
    for c in [*main_commits, *(c for batch in data["other_commits"] for c in batch)]:
        commits.setdefault(c["sha"], c)

    default = meta["default_branch"]
    branches = [(b["name"], b["commit"]["sha"]) for b in data["branches"]]
    if main_commits and all(n != default for n, _ in branches):  # >100 branches: default may be missing
        branches.append((default, main_commits[0]["sha"]))

    release_dates = {r["tag_name"]: r.get("published_at") for r in data["releases"]}

    def tag_date(t: dict) -> datetime | None:
        if d := _dt(release_dates.get(t["name"])):
            return d
        c = commits.get(t["commit"]["sha"])
        return _dt(c["commit"]["committer"]["date"]) if c else None

    return {
        "branches": [
            {"repo_id": repo_id, "name": n, "head_sha": sha, "is_default": n == default} for n, sha in branches
        ],
        "tags": [
            {"repo_id": repo_id, "name": t["name"], "sha": t["commit"]["sha"], "released_at": tag_date(t)}
            for t in data["tags"]
        ],
        "commits": [commit_row(repo_id, c) for c in commits.values()],
    }


async def sync_repo(repo_id: uuid.UUID) -> None:
    """Background task: fetch from GitHub and store. Uses its own DB session."""
    async with SessionLocal() as session:
        repo = await session.get(Repo, repo_id)
        if repo is None:
            return
        owner, name = repo.owner, repo.name
        repo.sync_status, repo.sync_error = "syncing", None
        await session.commit()
        try:
            data = await fetch_repo_data(owner, name)
            await _store(session, repo_id, data)
        except GitHubError as e:
            await _mark_failed(session, repo_id, e.message)
        except Exception:
            log.exception("repo sync failed: %s/%s", owner, name)
            await _mark_failed(session, repo_id, "Unexpected error while syncing. Try again later.")


async def _store(session: AsyncSession, repo_id: uuid.UUID, data: dict) -> None:
    rows = build_rows(repo_id, data)
    await session.execute(delete(RepoBranch).where(RepoBranch.repo_id == repo_id))
    await session.execute(delete(RepoTag).where(RepoTag.repo_id == repo_id))
    session.add_all(RepoBranch(**b) for b in rows["branches"])
    session.add_all(RepoTag(**t) for t in rows["tags"])
    if rows["commits"]:
        stmt = pg_insert(RepoCommit).values(rows["commits"])
        await session.execute(stmt.on_conflict_do_nothing(constraint="uq_repo_commits_repo_sha"))

    meta = data["meta"]
    repo = await session.get(Repo, repo_id)
    repo.full_name = meta["full_name"]
    repo.github_id = meta["id"]
    repo.description = (meta.get("description") or "")[:500] or None
    repo.stars = meta.get("stargazers_count", 0)
    repo.default_branch = meta["default_branch"]
    repo.sync_status, repo.sync_error = "ok", None
    repo.last_synced_at = datetime.now(timezone.utc)
    await session.commit()


async def _mark_failed(session: AsyncSession, repo_id: uuid.UUID, message: str) -> None:
    await session.rollback()
    repo = await session.get(Repo, repo_id)
    if repo:
        repo.sync_status, repo.sync_error = "failed", message
        await session.commit()
