import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.users.models import Role


class UserOut(BaseModel):
    """What the API returns about a user. Never includes password_hash."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    name: str
    avatar_url: str | None
    role: Role
    xp: int
    streak_days: int
    created_at: datetime


class UserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # role, email, xp... can't be smuggled in

    name: str | None = Field(default=None, min_length=1, max_length=100)

    @field_validator("name")
    @classmethod
    def _strip(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = " ".join(v.split())
        if not v:
            raise ValueError("Name can't be empty")
        return v
