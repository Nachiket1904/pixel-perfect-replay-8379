from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.core import ratelimit
from app.core.config import get_settings
from app.core.deps import CurrentUser, SessionDep
from app.modules.generator import limits, service
from app.modules.generator.llm import LLMClient, LLMResult, get_llm
from app.modules.generator.schemas import GenerateIn, QuotaOut
from app.modules.roadmaps.schemas import RoadmapOut

router = APIRouter(prefix="/generator", tags=["generator"])

DAY = 24 * 3600


@router.get("/quota", response_model=QuotaOut)
async def get_quota(session: SessionDep, user: CurrentUser):
    return await limits.quota(session, user, get_settings())


@router.post("/roadmaps", response_model=RoadmapOut, status_code=status.HTTP_201_CREATED)
async def generate_roadmap(
    body: GenerateIn,
    request: Request,
    session: SessionDep,
    user: CurrentUser,
    llm: Annotated[LLMClient, Depends(get_llm)],
):
    settings = get_settings()
    redis = request.app.state.redis

    await limits.require_quota(session, user, settings)  # cheap DB check first
    await ratelimit.hit(redis, f"gen-attempts:{user.id}", settings.generator_daily_attempts, DAY)
    lock = await limits.acquire_lock(redis, user)
    try:
        await limits.require_quota(session, user, settings)  # re-check inside the lock
        await limits.require_budget(redis, settings)

        async def on_usage(result: LLMResult) -> None:
            await limits.record_usage(redis, settings, result)

        return await service.generate(session, user, body, llm, on_usage)
    finally:
        await limits.release_lock(redis, lock)
