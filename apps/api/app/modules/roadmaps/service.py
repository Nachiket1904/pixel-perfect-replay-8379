from typing import Literal
from urllib.parse import quote_plus

from fastapi import status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.modules.exercises.queries import exercise_for_node, node_ids_with_exercises
from app.modules.progress.queries import progress_by_roadmap, statuses_for
from app.modules.roadmaps.models import Roadmap, RoadmapNode, RoadmapSource, Visibility
from app.modules.roadmaps.schemas import (
    EdgeOut,
    NodeDetailOut,
    NodeOut,
    NodeRef,
    NodeStatus,
    Position,
    ProgressOut,
    ResourceOut,
    RoadmapOut,
    RoadmapSummaryOut,
)
from app.modules.users.models import User

RoadmapFilter = Literal["all", "official", "mine"]
MAX_LIST = 100  # the catalog is small in v1; switch to cursor pagination when it isn't


def visible_to(user: User | None):  # noqa: ANN202
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
    query: Select = select(Roadmap, node_count.label("node_count")).where(visible_to(user))
    if filter_ == "official":
        query = query.where(Roadmap.source == RoadmapSource.official)
    elif filter_ == "mine":
        query = query.where(Roadmap.owner_id == user.id)  # type: ignore[union-attr]
    # Official first, then the learner's newest roadmaps.
    query = query.order_by(
        (Roadmap.source == RoadmapSource.official).desc(), Roadmap.created_at.desc()
    ).limit(MAX_LIST)

    rows = (await session.execute(query)).all()
    done_by_roadmap = await progress_by_roadmap(session, user, [r.id for r, _ in rows])
    out = []
    for roadmap, count in rows:
        item = summary(roadmap, count)
        if roadmap.id in done_by_roadmap:  # null progress = not started
            item.progress = ProgressOut(done=done_by_roadmap[roadmap.id], total=count)
        out.append(item)
    return out


async def load_roadmap(session: AsyncSession, user: User | None, slug: str) -> Roadmap:
    roadmap = await session.scalar(
        select(Roadmap)
        .where(Roadmap.slug == slug, visible_to(user))
        .options(selectinload(Roadmap.nodes), selectinload(Roadmap.edges))
    )
    if roadmap is None:
        raise _not_found(slug)
    return roadmap


def to_roadmap_out(
    roadmap: Roadmap, statuses: dict | None = None, with_exercise: set | None = None
) -> RoadmapOut:
    statuses = statuses or {}
    with_exercise = with_exercise or set()
    keys = {n.id: n.key for n in roadmap.nodes}
    base = summary(roadmap, len(roadmap.nodes))
    if statuses:
        done = sum(1 for s in statuses.values() if s == "done")
        base.progress = ProgressOut(done=done, total=len(roadmap.nodes))
    return RoadmapOut(
        **base.model_dump(),
        goal_prompt=roadmap.goal_prompt,
        created_at=roadmap.created_at,
        nodes=[_node_out(n, statuses.get(n.id, "not_started"), n.id in with_exercise) for n in roadmap.nodes],
        edges=[
            EdgeOut(id=e.id, from_node_id=keys[e.from_node_id], to_node_id=keys[e.to_node_id], kind=e.kind)
            for e in roadmap.edges
        ],
    )


def summary(roadmap: Roadmap, node_count: int) -> RoadmapSummaryOut:
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


async def get_roadmap(session: AsyncSession, user: User | None, slug: str) -> RoadmapOut:
    roadmap = await load_roadmap(session, user, slug)
    statuses = await statuses_for(session, user, roadmap.id)
    with_exercise = await node_ids_with_exercises(session, [n.id for n in roadmap.nodes])
    return to_roadmap_out(roadmap, statuses, with_exercise)


def _node_out(node: RoadmapNode, status: NodeStatus = "not_started", has_exercise: bool = False) -> NodeOut:
    return NodeOut(
        status=status,
        has_exercise=has_exercise,
        id=node.key,
        title=node.title,
        summary=node.summary,
        node_type=node.node_type,
        position=Position(x=node.position_x, y=node.position_y),
    )


# ---------- Topic page (Day 10) ----------


def _fallback_content(node: RoadmapNode) -> tuple[str, list[ResourceOut]]:
    """Nodes without hand-written content still get a useful page instead of a blank one."""
    content = node.content_md.strip() or (
        f"## Overview\n{node.summary}\n\n## Suggested approach\n"
        "Start with the official documentation, then watch one short video "
        "and try a small example of your own."
    )
    resources = [ResourceOut.model_validate(r) for r in node.resources] or [
        ResourceOut(
            title=f"YouTube: {node.title}",
            url=f"https://www.youtube.com/results?search_query={quote_plus(node.title)}",
            kind="search",
            is_free=True,
        )
    ]
    return content, resources


async def get_node(session: AsyncSession, user: User | None, slug: str, key: str) -> NodeDetailOut:
    roadmap = await load_roadmap(session, user, slug)  # visibility check happens here
    by_id = {n.id: n for n in roadmap.nodes}
    node = next((n for n in roadmap.nodes if n.key == key), None)
    if node is None:
        raise AppError("NOT_FOUND", f"Topic “{key}” was not found.", status.HTTP_404_NOT_FOUND)

    statuses = await statuses_for(session, user, roadmap.id)

    def ref(n: RoadmapNode) -> NodeRef:
        return NodeRef(id=n.key, title=n.title, status=statuses.get(n.id, "not_started"))

    content_md, resources = _fallback_content(node)
    exercise = await exercise_for_node(session, node.id)
    return NodeDetailOut(
        **_node_out(node, statuses.get(node.id, "not_started"), exercise is not None).model_dump(),
        exercise=exercise,
        roadmap_id=roadmap.id,
        roadmap_slug=roadmap.slug,
        roadmap_title=roadmap.title,
        roadmap_source=roadmap.source,
        content_md=content_md,
        resources=resources,
        prerequisites=[ref(by_id[e.from_node_id]) for e in roadmap.edges if e.to_node_id == node.id],
        unlocks=[ref(by_id[e.to_node_id]) for e in roadmap.edges if e.from_node_id == node.id],
    )
