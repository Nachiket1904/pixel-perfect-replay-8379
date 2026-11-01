import uuid
from typing import Annotated

from fastapi import APIRouter, Path, Request, status

from app.core import ratelimit
from app.core.deps import CurrentUser, OptionalUser, SessionDep
from app.modules.exercises import service
from app.modules.exercises.schemas import HintOut, SolutionOut, SubmissionIn, SubmissionsSummary

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.post(
    "/{exercise_id}/submissions",
    response_model=SubmissionsSummary,
    status_code=status.HTTP_201_CREATED,
)
async def create_submission(
    exercise_id: uuid.UUID,
    body: SubmissionIn,
    request: Request,
    session: SessionDep,
    user: CurrentUser,
):
    await ratelimit.hit(request.app.state.redis, f"submit:{user.id}", limit=20, window_seconds=60)
    return await service.submit(session, user, exercise_id, body)


@router.get("/{exercise_id}/submissions/latest", response_model=SubmissionsSummary)
async def latest_submission(exercise_id: uuid.UUID, session: SessionDep, user: CurrentUser):
    ex = await service.get_visible_exercise(session, user, exercise_id)
    return await service.summary(session, user, ex)


@router.get("/{exercise_id}/hints/{index}", response_model=HintOut)
async def get_hint(
    exercise_id: uuid.UUID,
    index: Annotated[int, Path(ge=1, le=5)],
    session: SessionDep,
    user: OptionalUser,
):
    return await service.get_hint(session, user, exercise_id, index)


@router.get("/{exercise_id}/solution", response_model=SolutionOut)
async def get_solution(exercise_id: uuid.UUID, session: SessionDep, user: CurrentUser):
    return await service.get_solution(session, user, exercise_id)
