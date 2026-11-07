import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.github import service
from app.modules.github.deps import get_current_user, get_session
from app.modules.github.models import Repo, RepoAnalysis
from app.modules.github.schemas import AnalyzeIn, FileOut, RepoOut, StructureOut

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
        has_result = repo.sync_status != "ok" or await session.get(RepoAnalysis, repo.id) is not None
        if has_result:
            return repo  # fresh or already running: no GitHub calls, no rate-limit charge

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


async def _get_analysis(session: AsyncSession, repo_id: uuid.UUID) -> RepoAnalysis:
    analysis = await session.get(RepoAnalysis, repo_id)
    if analysis is None:
        raise HTTPException(status_code=404, detail="This repository hasn't been analyzed yet.")
    return analysis


@router.get("/{repo_id}", response_model=RepoOut)
async def get_repo(repo_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    return await _get_repo(session, repo_id)


@router.get("/{repo_id}/structure", response_model=StructureOut)
async def get_structure(repo_id: uuid.UUID, session: AsyncSession = Depends(get_session)):
    repo = await _get_repo(session, repo_id)
    analysis = await _get_analysis(session, repo_id)
    return {"repo": repo, "analysis": analysis.data}


@router.get("/{repo_id}/file", response_model=FileOut)
async def get_file(
    repo_id: uuid.UUID,
    path: str = Query(min_length=1, max_length=500),
    session: AsyncSession = Depends(get_session),
    user=Depends(get_current_user),
):
    repo = await _get_repo(session, repo_id)
    analysis = await _get_analysis(session, repo_id)
    return await service.file_content(repo, analysis, path)
