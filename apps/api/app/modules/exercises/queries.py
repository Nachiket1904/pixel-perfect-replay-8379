"""Read helpers used by the roadmaps module. Imports nothing from roadmaps (no cycles)."""

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.exercises.models import Exercise
from app.modules.exercises.schemas import ExerciseOut, TestCaseOut


async def node_ids_with_exercises(session: AsyncSession, node_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    if not node_ids:
        return set()
    rows = await session.scalars(select(Exercise.node_id).where(Exercise.node_id.in_(node_ids)))
    return set(rows.all())


async def exercise_for_node(session: AsyncSession, node_id: uuid.UUID) -> ExerciseOut | None:
    ex = await session.scalar(select(Exercise).where(Exercise.node_id == node_id))
    if ex is None:
        return None
    return ExerciseOut(
        id=ex.id,
        title=ex.title,
        language="python",
        prompt_md=ex.prompt_md,
        starter_code=ex.starter_code,
        tests=[TestCaseOut(name=t["name"], code=t["code"]) for t in ex.tests],
        hints_count=len(ex.hints),
    )
