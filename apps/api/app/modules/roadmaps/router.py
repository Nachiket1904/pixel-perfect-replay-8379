from typing import Annotated

from fastapi import APIRouter, Path, Query

from app.core.deps import OptionalUser, SessionDep
from app.modules.roadmaps import service
from app.modules.roadmaps.content import SLUG_PATTERN
from app.modules.roadmaps.schemas import RoadmapOut, RoadmapSummaryOut

router = APIRouter(prefix="/roadmaps", tags=["roadmaps"])

Slug = Annotated[str, Path(pattern=SLUG_PATTERN, max_length=120)]


@router.get("", response_model=list[RoadmapSummaryOut])
async def list_roadmaps(
    session: SessionDep,
    user: OptionalUser,
    filter: Annotated[service.RoadmapFilter, Query()] = "all",  # noqa: A002
):
    return await service.list_roadmaps(session, user, filter)


@router.get("/{slug}", response_model=RoadmapOut)
async def get_roadmap(slug: Slug, session: SessionDep, user: OptionalUser):
    roadmap = await service.load_roadmap(session, user, slug)
    return service.to_roadmap_out(roadmap)
