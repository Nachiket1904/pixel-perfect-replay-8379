"""Read helpers shared with the roadmaps module. Imports nothing from roadmaps (no cycles)."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.progress.models import NodeStatus as StoredStatus
from app.modules.progress.models import UserNodeProgress
from app.modules.users.models import User


async def statuses_for(
    session: AsyncSession, user: User | None, roadmap_id: uuid.UUID
) -> dict[uuid.UUID, str]:
    """node_id -> status for one roadmap. Empty for anonymous users."""
    if user is None:
        return {}
    rows = await session.execute(
        select(UserNodeProgress.node_id, UserNodeProgress.status).where(
            UserNodeProgress.user_id == user.id, UserNodeProgress.roadmap_id == roadmap_id
        )
    )
    return {node_id: s.value for node_id, s in rows.all()}


async def progress_by_roadmap(
    session: AsyncSession, user: User | None, roadmap_ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    """roadmap_id -> done count, only for roadmaps the user has started (any row)."""
    if user is None or not roadmap_ids:
        return {}
    done = func.count().filter(UserNodeProgress.status == StoredStatus.done)
    rows = await session.execute(
        select(UserNodeProgress.roadmap_id, done)
        .where(UserNodeProgress.user_id == user.id, UserNodeProgress.roadmap_id.in_(roadmap_ids))
        .group_by(UserNodeProgress.roadmap_id)
    )
    return dict(rows.all())
