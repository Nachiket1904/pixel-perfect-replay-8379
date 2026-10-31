import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPk


class Role(enum.StrEnum):
    learner = "learner"
    instructor = "instructor"
    admin = "admin"


class User(UUIDPk, Timestamps, Base):
    __tablename__ = "users"

    # Stored lowercase; uniqueness is enforced by the DB, not just by a SELECT before INSERT.
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    password_hash: Mapped[str | None] = mapped_column(String(255))  # null for OAuth-only users (later)
    avatar_url: Mapped[str | None] = mapped_column(String(500))
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="user_role", values_callable=lambda e: [m.value for m in e]),
        default=Role.learner,
        server_default=Role.learner.value,
    )
    auth_provider: Mapped[str] = mapped_column(String(20), default="password", server_default="password")
    github_username: Mapped[str | None] = mapped_column(String(100))
    xp: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    streak_days: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    last_active_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
