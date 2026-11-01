"""Exercise submissions.

v1 runs code in the learner's browser, so a submission is the client's report of what happened.
We store it (attempt history, restoring code, "show solution after 3 attempts") but
mark it unverified. Anything that must be trustworthy (certificates, leaderboards) needs a
server-side re-run in the v2 sandbox. We still reject reports that are internally inconsistent.
"""

import uuid

from fastapi import status as http
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.exercises.models import Exercise, Submission, SubmissionStatus
from app.modules.exercises.schemas import (
    HintOut,
    SolutionOut,
    SubmissionIn,
    SubmissionOut,
    SubmissionsSummary,
)
from app.modules.progress.service import mark_done
from app.modules.roadmaps.models import Roadmap, RoadmapNode
from app.modules.roadmaps.service import visible_to
from app.modules.users.models import User

KEEP_PER_EXERCISE = 50  # newest submissions kept per learner per exercise
SOLUTION_AFTER_ATTEMPTS = 3


async def get_visible_exercise(session: AsyncSession, user: User | None, exercise_id: uuid.UUID) -> Exercise:
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
        latest=_out(latest) if latest else None,
        attempts=attempts,
        passed_ever=passed_ever,
        solution_unlocked=passed_ever or attempts >= SOLUTION_AFTER_ATTEMPTS,
        attempts_to_unlock=SOLUTION_AFTER_ATTEMPTS,
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

    if body.status == "passed":
        # Solving the exercise finishes the topic. Progress is self-reported anyway (the learner
        # can click "Done"), so trusting the browser here grants nothing they couldn't already do.
        node = await session.get(RoadmapNode, ex.node_id)
        if node is not None:
            await mark_done(session, user, node)

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


async def get_hint(session: AsyncSession, user: User | None, exercise_id: uuid.UUID, index: int) -> HintOut:
    """Hints are not secret (anyone who can see the topic can read them), just revealed one by one."""
    ex = await get_visible_exercise(session, user, exercise_id)
    if not 1 <= index <= len(ex.hints):
        raise AppError("NOT_FOUND", "That hint doesn't exist.", http.HTTP_404_NOT_FOUND)
    return HintOut(index=index, total=len(ex.hints), text=ex.hints[index - 1])


async def get_solution(session: AsyncSession, user: User, exercise_id: uuid.UUID) -> SolutionOut:
    """The reference solution, only after enough real attempts. Enforced here, never in the UI."""
    ex = await get_visible_exercise(session, user, exercise_id)
    state = await summary(session, user, ex)
    if not state.solution_unlocked:
        raise AppError(
            "FORBIDDEN",
            f"Make {SOLUTION_AFTER_ATTEMPTS} attempts first, then the solution unlocks.",
            http.HTTP_403_FORBIDDEN,
            {"attempts": state.attempts, "attempts_to_unlock": SOLUTION_AFTER_ATTEMPTS},
        )
    return SolutionOut(solution_code=ex.solution_code)
