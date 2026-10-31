from typing import Annotated

from fastapi import APIRouter, Path, Request

from app.core import ratelimit
from app.core.deps import CurrentUser, SessionDep
from app.modules.progress import service
from app.modules.progress.schemas import DashboardOut, StatusOut, StatusUpdate
from app.modules.roadmaps.content import KEY_PATTERN, SLUG_PATTERN

router = APIRouter(tags=["progress"])

Slug = Annotated[str, Path(pattern=SLUG_PATTERN, max_length=120)]
NodeKey = Annotated[str, Path(pattern=KEY_PATTERN, max_length=80)]


@router.put("/roadmaps/{slug}/nodes/{node_key}/progress", response_model=StatusOut)
async def update_progress(
    slug: Slug,
    node_key: NodeKey,
    body: StatusUpdate,
    request: Request,
    session: SessionDep,
    user: CurrentUser,
):
    # Generous for real clicking, tight enough to stop a script hammering the DB.
    await ratelimit.hit(request.app.state.redis, f"progress:{user.id}", limit=60, window_seconds=60)
    return await service.set_status(session, user, slug, node_key, body.status)


@router.get("/users/me/dashboard", response_model=DashboardOut)
async def get_dashboard(session: SessionDep, user: CurrentUser):
    return await service.dashboard(session, user)
