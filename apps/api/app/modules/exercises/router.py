import uuid

from fastapi import APIRouter, Request, status

from app.core import ratelimit
from app.core.deps import CurrentUser, SessionDep
from app.modules.exercises import service
from app.modules.exercises.schemas import SubmissionIn, SubmissionsSummary

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
