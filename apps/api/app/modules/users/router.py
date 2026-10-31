from fastapi import APIRouter

from app.core.deps import CurrentUser, SessionDep
from app.modules.users.schemas import UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
async def read_me(user: CurrentUser):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(data: UserUpdate, user: CurrentUser, session: SessionDep):
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await session.commit()
    await session.refresh(user)
    return user
