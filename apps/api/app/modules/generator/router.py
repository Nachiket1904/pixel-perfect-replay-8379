from typing import Annotated

from fastapi import APIRouter, Depends, Request, status

from app.core import ratelimit
from app.core.deps import CurrentUser, SessionDep
from app.modules.generator import service
from app.modules.generator.llm import LLMClient, get_llm
from app.modules.generator.schemas import GenerateIn
from app.modules.roadmaps.schemas import RoadmapOut

router = APIRouter(prefix="/generator", tags=["generator"])


@router.post("/roadmaps", response_model=RoadmapOut, status_code=status.HTTP_201_CREATED)
async def generate_roadmap(
    body: GenerateIn,
    request: Request,
    session: SessionDep,
    user: CurrentUser,
    llm: Annotated[LLMClient, Depends(get_llm)],
):
    # Burst guard. Daily limits and the spend cap arrive on Day 20.
    await ratelimit.hit(request.app.state.redis, f"gen-burst:{user.id}", limit=3, window_seconds=60)
    return await service.generate(session, user, body, llm)
