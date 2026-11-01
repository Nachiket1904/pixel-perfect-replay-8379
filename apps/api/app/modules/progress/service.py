"""Per-user node progress, streaks and the dashboard.

Rules:
- Progress can only be written for roadmaps the user can see (same visibility rule as reads).
- "not_started" deletes the row, so a never-touched node and a reset node look identical.
- The streak counts calendar days (IST) on which the learner changed any progress.
"""

import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import status as http
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.errors import AppError
from app.modules.progress.models import NodeStatus as StoredStatus
from app.modules.progress.models import UserNodeProgress
from app.modules.progress.queries import statuses_for
from app.modules.progress.schemas import ActiveRoadmapOut, DashboardOut, StatusOut
from app.modules.roadmaps import service as roadmaps
from app.modules.roadmaps.models import Roadmap, RoadmapNode
from app.modules.roadmaps.schemas import NodeRef, NodeStatus, ProgressOut
from app.modules.users.models import User

# v1 audience is in India. Move to profiles.timezone when that exists.
TZ = ZoneInfo("Asia/Kolkata")
MAX_ACTIVE = 10


def _today() -> date:
    return datetime.now(TZ).date()


def touch_activity(user: User) -> None:
    """Advance the streak once per IST calendar day."""
    today = _today()
    last = user.last_active_at.astimezone(TZ).date() if user.last_active_at else None
    if last == today:
        # Login also updates last_active_at, so the first progress of the day may find a 0 streak.
        user.streak_days = max(user.streak_days, 1)
    elif last == today - timedelta(days=1):
        user.streak_days += 1
    else:
        user.streak_days = 1
    user.last_active_at = datetime.now(TZ)


def effective_streak(user: User) -> tuple[int, str]:
    """A streak only counts while it's alive: active today or yesterday."""
    if user.last_active_at is None:
        return 0, "never"
    last = user.last_active_at.astimezone(TZ).date()
    today = _today()
    if last == today:
        return user.streak_days, "today"
    if last == today - timedelta(days=1):
        return user.streak_days, "yesterday"
    return 0, "lapsed"


async def set_status(
    session: AsyncSession, user: User, slug: str, key: str, new_status: NodeStatus
) -> StatusOut:
    roadmap = await roadmaps.load_roadmap(session, user, slug)  # 404 if not visible
    node = next((n for n in roadmap.nodes if n.key == key), None)
    if node is None:
        raise AppError("NOT_FOUND", f"Topic “{key}” was not found.", http.HTTP_404_NOT_FOUND)

    if new_status == "not_started":
        await session.execute(
            delete(UserNodeProgress).where(
                UserNodeProgress.user_id == user.id, UserNodeProgress.node_id == node.id
            )
        )
    else:
        stmt = insert(UserNodeProgress).values(
            user_id=user.id, node_id=node.id, roadmap_id=roadmap.id, status=StoredStatus(new_status)
        )
        # Upsert: double clicks and retries are harmless.
        await session.execute(
            stmt.on_conflict_do_update(
                index_elements=[UserNodeProgress.user_id, UserNodeProgress.node_id],
                set_={"status": stmt.excluded.status, "updated_at": func.now()},
            )
        )

    touch_activity(user)
    await session.commit()

    statuses = await statuses_for(session, user, roadmap.id)
    done = sum(1 for s in statuses.values() if s == "done")
    return StatusOut(node_id=key, status=new_status, done=done, total=len(roadmap.nodes))


async def mark_done(session: AsyncSession, user: User, node: RoadmapNode) -> None:
    """Set one topic to done (used when its exercise is solved). The caller commits."""
    stmt = insert(UserNodeProgress).values(
        user_id=user.id, node_id=node.id, roadmap_id=node.roadmap_id, status=StoredStatus.done
    )
    await session.execute(
        stmt.on_conflict_do_update(
            index_elements=[UserNodeProgress.user_id, UserNodeProgress.node_id],
            set_={"status": stmt.excluded.status, "updated_at": func.now()},
        )
    )
    touch_activity(user)


def next_node(roadmap: Roadmap, statuses: dict[uuid.UUID, NodeStatus]) -> RoadmapNode | None:
    """First in-progress topic, else the first not-started topic whose prerequisites are done."""
    for n in roadmap.nodes:
        if statuses.get(n.id) == "in_progress":
            return n
    done = {nid for nid, s in statuses.items() if s == "done"}
    for n in roadmap.nodes:
        if n.id in statuses:
            continue
        prereqs = [e.from_node_id for e in roadmap.edges if e.to_node_id == n.id]
        if all(p in done for p in prereqs):
            return n
    return None


async def dashboard(session: AsyncSession, user: User) -> DashboardOut:
    # Roadmaps with any progress, most recently touched first. Visibility still applies:
    # if a roadmap became private to someone else, it disappears from the dashboard.
    last_touch = func.max(UserNodeProgress.updated_at).label("last_touch")
    started = (
        select(UserNodeProgress.roadmap_id, last_touch)
        .where(UserNodeProgress.user_id == user.id)
        .group_by(UserNodeProgress.roadmap_id)
        .subquery()
    )
    result = await session.scalars(
        select(Roadmap)
        .join(started, started.c.roadmap_id == Roadmap.id)
        .where(roadmaps.visible_to(user))
        .options(selectinload(Roadmap.nodes), selectinload(Roadmap.edges))
        .order_by(started.c.last_touch.desc())
        .limit(MAX_ACTIVE)
    )

    active: list[ActiveRoadmapOut] = []
    for roadmap in result.all():
        statuses = await statuses_for(session, user, roadmap.id)
        done = sum(1 for s in statuses.values() if s == "done")
        summary = roadmaps.summary(roadmap, len(roadmap.nodes))
        summary.progress = ProgressOut(done=done, total=len(roadmap.nodes))
        nxt = next_node(roadmap, statuses)
        active.append(
            ActiveRoadmapOut(
                roadmap=summary,
                next_node=NodeRef(id=nxt.key, title=nxt.title, status=statuses.get(nxt.id, "not_started"))
                if nxt
                else None,
            )
        )

    streak, activity = effective_streak(user)
    return DashboardOut(active=active, streak_days=streak, activity=activity)
