import asyncio
import json
import logging
import re
import uuid
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import HTTPException
from redis.asyncio import Redis
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.github.analyzer import analyze
from app.modules.github.client import GitHubClient, GitHubError
from app.modules.github.config import gh_settings
from app.modules.github.deps import SessionLocal
from app.modules.github.models import Repo, RepoAnalysis

log = logging.getLogger(__name__)

OWNER_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,100}$")
FILE_CACHE_SECONDS = 3600
MAX_FILE_VIEW_BYTES = 200_000

_redis: Redis | None = None


def _get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(gh_settings.redis_url)
    return _redis


def _token() -> str | None:
    return gh_settings.github_token.get_secret_value() if gh_settings.github_token else None


def parse_repo_url(raw: str) -> tuple[str, str]:
    """Accepts https://github.com/owner/name[/...], github.com/owner/name, or owner/name.

    Returns lowercased (owner, name). Anything that isn't github.com is rejected, so the
    server only ever talks to GitHub (no SSRF).
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


async def sync_repo(repo_id: uuid.UUID) -> None:
    """Background task: download the repo snapshot, analyze it, store the result."""
    async with SessionLocal() as session:
        repo = await session.get(Repo, repo_id)
        if repo is None:
            return
        owner, name = repo.owner, repo.name
        repo.sync_status, repo.sync_error = "syncing", None
        await session.commit()
        try:
            async with GitHubClient(_token()) as gh:
                meta = await gh.repo(owner, name)
                sha = await gh.head_sha(owner, name, meta["default_branch"])
                data = await gh.tarball(owner, name, sha, gh_settings.github_max_download_mb * 1_000_000)
            # Parsing hundreds of files is CPU work: keep it off the event loop.
            structure = await asyncio.to_thread(analyze, data)
            del data
            await _store(session, repo_id, meta, sha, structure)
        except GitHubError as e:
            await _mark_failed(session, repo_id, e.message)
        except Exception:
            log.exception("repo analysis failed: %s/%s", owner, name)
            await _mark_failed(session, repo_id, "Something went wrong while analyzing. Try again later.")


async def _store(session: AsyncSession, repo_id: uuid.UUID, meta: dict, sha: str, structure: dict) -> None:
    stmt = pg_insert(RepoAnalysis).values(repo_id=repo_id, commit_sha=sha, data=structure)
    stmt = stmt.on_conflict_do_update(
        index_elements=[RepoAnalysis.repo_id],
        set_={"commit_sha": sha, "data": structure, "updated_at": datetime.now(timezone.utc)},
    )
    await session.execute(stmt)

    repo = await session.get(Repo, repo_id)
    repo.full_name = meta["full_name"]
    repo.github_id = meta["id"]
    repo.description = (meta.get("description") or "")[:500] or None
    repo.stars = meta.get("stargazers_count", 0)
    repo.default_branch = meta["default_branch"]
    repo.commit_sha = sha
    repo.sync_status, repo.sync_error = "ok", None
    repo.last_synced_at = datetime.now(timezone.utc)
    await session.commit()


async def _mark_failed(session: AsyncSession, repo_id: uuid.UUID, message: str) -> None:
    await session.rollback()
    repo = await session.get(Repo, repo_id)
    if repo:
        repo.sync_status, repo.sync_error = "failed", message
        await session.commit()


async def file_content(repo: Repo, analysis: RepoAnalysis, path: str) -> dict:
    """Source of one analyzed code file. Only paths from the stored analysis are allowed."""
    if path not in {f["path"] for f in analysis.data.get("files", [])}:
        raise HTTPException(status_code=404, detail="File not found in this analysis.")
    key = f"repo-file:{repo.id}:{analysis.commit_sha}:{path}"
    redis = _get_redis()
    if cached := await redis.get(key):
        return json.loads(cached)
    try:
        async with GitHubClient(_token()) as gh:
            text, truncated = await gh.file_text(
                repo.owner, repo.name, path, analysis.commit_sha, MAX_FILE_VIEW_BYTES
            )
    except GitHubError as e:
        raise HTTPException(status_code=502, detail=e.message) from e
    result = {"path": path, "content": text, "truncated": truncated}
    await redis.set(key, json.dumps(result), ex=FILE_CACHE_SECONDS)
    return result
