import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.github import service
from app.modules.github.deps import get_current_user, get_session
from app.modules.github.models import Repo, RepoBranch, RepoCommit, RepoTag
from app.modules.github.schemas import AnalyzeIn, GraphOut, RepoOut

router = APIRouter(prefix="/repos", tags=["github"])


@router.post("/analyze", response_model=RepoOut, status_code=202)
async def analyze_repo(
    body: AnalyzeIn,
    background: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user),
):
    try:
        owner, name = service.parse_repo_url(body.url)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    repo = await session.scalar(select(Repo).where(Repo.owner == owner, Repo.name == name))
    if repo is not None and not service.needs_sync(repo):
        return repo  # fresh or already syncing: no GitHub calls, no rate-limit charge

    await service.check_analyze_limit(user.id)
    if repo is None:
        repo = Repo(owner=owner, name=name, full_name=f"{owner}/{name}")
        session.add(repo)
    repo.sync_status, repo.sync_error = "pending", None
    await session.commit()
    await session.refresh(repo)
    background.add_task(service.sync_repo, repo.id)
    return repo


async def _get_repo(session: AsyncSession, repo_id: uuid.UUID) -> Repo:
    repo = await session.get(Repo, repo_id)
    if repo is None:
        raise HTTPException(status_code=404, detail="Repository not found.")
    return repo


@router.get("/{repo_id}", response_model=RepoOut)
async def get_repo(repo_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await _get_repo(session, repo_id)


@router.get("/{repo_id}/graph", response_model=GraphOut)
async def get_graph(
    repo_id: uuid.UUID,
    limit: int = Query(300, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    repo = await _get_repo(session, repo_id)
    branches = await session.scalars(
        select(RepoBranch)
        .where(RepoBranch.repo_id == repo_id)
        .order_by(RepoBranch.is_default.desc(), RepoBranch.name)
    )
    tags = await session.scalars(
        select(RepoTag).where(RepoTag.repo_id == repo_id).order_by(RepoTag.released_at.desc().nulls_last())
    )
    commits = await session.scalars(
        select(RepoCommit)
        .where(RepoCommit.repo_id == repo_id)
        .order_by(RepoCommit.committed_at.desc())
        .limit(limit)
    )
    return {"repo": repo, "branches": branches.all(), "tags": tags.all(), "commits": commits.all()}
