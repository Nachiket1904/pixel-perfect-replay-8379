"""Exercise submissions.

v1 runs code in the learner's browser, so a submission is the client's report of what happened.
We store it (attempt history, restoring code, "show solution after 3 attempts" on Day 18) but
mark it unverified. Anything that must be trustworthy (certificates, leaderboards) needs a
server-side re-run in the v2 sandbox. We still reject reports that are internally inconsistent.
"""

import uuid

from fastapi import status as http
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.exercises.models import Exercise, Submission, SubmissionStatus
from app.modules.exercises.schemas import SubmissionIn, SubmissionOut, SubmissionsSummary
from app.modules.roadmaps.models import Roadmap, RoadmapNode
from app.modules.roadmaps.service import visible_to
from app.modules.users.models import User

KEEP_PER_EXERCISE = 50  # newest submissions kept per learner per exercise


async def get_visible_exercise(session: AsyncSession, user: User, exercise_id: uuid.UUID) -> Exercise:
    ex = await session.scalar(
        select(Exercise)
        .join(RoadmapNode, RoadmapNode.id == Exercise.node_id)
        .join(Roadmap, Roadmap.id == RoadmapNode.roadmap_id)
        .where(Exercise.id == exercise_id, visible_to(user))
    )
    if ex is None:
        raise AppError("NOT_FOUND", "Exercise not found.", http.HTTP_404_NOT_FOUND)
    return ex


def _check_consistent(ex: Exercise, body: SubmissionIn) -> None:
    names = [r.name for r in body.results]
    known = {t["name"] for t in ex.tests}
    problem = None
    if len(names) != len(set(names)):
        problem = "Duplicate test results."
    elif not set(names) <= known:
        problem = "Results mention tests this exercise doesn't have."
    elif body.status == "passed" and (set(names) != known or not all(r.passed for r in body.results)):
        problem = "A passed submission needs every test to pass."
    elif body.status == "failed" and (not names or all(r.passed for r in body.results)):
        problem = "A failed submission needs at least one failing test."
    if problem:
        raise AppError("VALIDATION_ERROR", problem, http.HTTP_422_UNPROCESSABLE_CONTENT)


def _out(s: Submission) -> SubmissionOut:
    return SubmissionOut(
        id=s.id,
        status=s.status.value,
        code=s.code,
        results=s.result.get("tests", []),
        error=s.result.get("error"),
        runtime_ms=s.runtime_ms,
        verified=s.verified,
        created_at=s.created_at,
    )


async def summary(session: AsyncSession, user: User, ex: Exercise) -> SubmissionsSummary:
    base = select(Submission).where(Submission.user_id == user.id, Submission.exercise_id == ex.id)
    latest = await session.scalar(base.order_by(Submission.created_at.desc()).limit(1))
    attempts = await session.scalar(select(func.count()).select_from(base.subquery())) or 0
    passed_ever = (
        await session.scalar(base.where(Submission.status == SubmissionStatus.passed).limit(1))
    ) is not None
    return SubmissionsSummary(
        latest=_out(latest) if latest else None, attempts=attempts, passed_ever=passed_ever
    )


async def submit(
    session: AsyncSession, user: User, exercise_id: uuid.UUID, body: SubmissionIn
) -> SubmissionsSummary:
    ex = await get_visible_exercise(session, user, exercise_id)
    _check_consistent(ex, body)
    session.add(
        Submission(
            user_id=user.id,
            exercise_id=ex.id,
            code=body.code,
            status=SubmissionStatus(body.status),
            result={"tests": [r.model_dump() for r in body.results], "error": body.error},
            runtime_ms=body.runtime_ms,
            verified=False,
        )
    )
    await session.flush()

    # Bound storage: keep only the newest N per learner per exercise.
    keep = (
        select(Submission.id)
        .where(Submission.user_id == user.id, Submission.exercise_id == ex.id)
        .order_by(Submission.created_at.desc())
        .limit(KEEP_PER_EXERCISE)
    )
    await session.execute(
        delete(Submission).where(
            Submission.user_id == user.id,
            Submission.exercise_id == ex.id,
            Submission.id.not_in(keep),
        )
    )
    await session.commit()
    return await summary(session, user, ex)
