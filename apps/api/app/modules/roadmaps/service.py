from typing import Literal

from fastapi import status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.modules.roadmaps.models import Roadmap, RoadmapNode, RoadmapSource, Visibility
from app.modules.roadmaps.schemas import (
    EdgeOut,
    NodeOut,
    Position,
    RoadmapOut,
    RoadmapSummaryOut,
)
from app.modules.users.models import User

RoadmapFilter = Literal["all", "official", "mine"]
MAX_LIST = 100  # the catalog is small in v1; switch to cursor pagination when it isn't


def _visible_to(user: User | None):  # noqa: ANN202
    """Public roadmaps for everyone, plus private ones the user owns."""
    if user is None:
        return Roadmap.visibility == Visibility.public
    return or_(Roadmap.visibility == Visibility.public, Roadmap.owner_id == user.id)


def _not_found(slug: str) -> AppError:
    # Same answer for "doesn't exist" and "private, not yours" so private slugs can't be probed.
    return AppError("NOT_FOUND", f"Roadmap “{slug}” was not found.", status.HTTP_404_NOT_FOUND)


async def list_roadmaps(
    session: AsyncSession, user: User | None, filter_: RoadmapFilter
) -> list[RoadmapSummaryOut]:
    if filter_ == "mine" and user is None:
        return []

    node_count = (
        select(func.count(RoadmapNode.id))
        .where(RoadmapNode.roadmap_id == Roadmap.id)
        .correlate(Roadmap)
        .scalar_subquery()
    )
    query: Select = select(Roadmap, node_count.label("node_count")).where(_visible_to(user))
    if filter_ == "official":
        query = query.where(Roadmap.source == RoadmapSource.official)
    elif filter_ == "mine":
        query = query.where(Roadmap.owner_id == user.id)  # type: ignore[union-attr]
    # Official first, then the learner's newest roadmaps.
    query = query.order_by(
        (Roadmap.source == RoadmapSource.official).desc(), Roadmap.created_at.desc()
    ).limit(MAX_LIST)

    rows = (await session.execute(query)).all()
    return [_summary(roadmap, count) for roadmap, count in rows]


async def load_roadmap(session: AsyncSession, user: User | None, slug: str) -> Roadmap:
    roadmap = await session.scalar(
        select(Roadmap)
        .where(Roadmap.slug == slug, _visible_to(user))
        .options(selectinload(Roadmap.nodes), selectinload(Roadmap.edges))
    )
    if roadmap is None:
        raise _not_found(slug)
    return roadmap


def to_roadmap_out(roadmap: Roadmap) -> RoadmapOut:
    keys = {n.id: n.key for n in roadmap.nodes}
    return RoadmapOut(
        **_summary(roadmap, len(roadmap.nodes)).model_dump(),
        goal_prompt=roadmap.goal_prompt,
        created_at=roadmap.created_at,
        nodes=[_node_out(n) for n in roadmap.nodes],
        edges=[
            EdgeOut(id=e.id, from_node_id=keys[e.from_node_id], to_node_id=keys[e.to_node_id], kind=e.kind)
            for e in roadmap.edges
        ],
    )


def _summary(roadmap: Roadmap, node_count: int) -> RoadmapSummaryOut:
    return RoadmapSummaryOut(
        id=roadmap.id,
        slug=roadmap.slug,
        title=roadmap.title,
        description=roadmap.description,
        source=roadmap.source,
        level=roadmap.level,
        node_count=node_count,
        estimated_hours=roadmap.estimated_hours,
    )


def _node_out(node: RoadmapNode) -> NodeOut:
    return NodeOut(
        id=node.key,
        title=node.title,
        summary=node.summary,
        node_type=node.node_type,
        position=Position(x=node.position_x, y=node.position_y),
    )
