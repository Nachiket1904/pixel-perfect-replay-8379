import enum
import uuid
from typing import Any

from sqlalchemy import Boolean, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps, UUIDPk


def _enum(cls: type[enum.Enum], name: str) -> Enum:
    return Enum(cls, name=name, values_callable=lambda e: [m.value for m in e])


class RunMode(enum.StrEnum):
    browser = "browser"
    server = "server"  # v2: server sandbox


class SubmissionStatus(enum.StrEnum):
    passed = "passed"
    failed = "failed"
    error = "error"


class Exercise(UUIDPk, Timestamps, Base):
    """One coding exercise per topic, synced from packages/content by the seed script."""

    __tablename__ = "exercises"

    node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="CASCADE"), unique=True
    )
    title: Mapped[str] = mapped_column(String(200))
    prompt_md: Mapped[str] = mapped_column(Text)
    language: Mapped[str] = mapped_column(String(20), default="python")
    starter_code: Mapped[str] = mapped_column(Text, default="")
    solution_code: Mapped[str] = mapped_column(Text)  # never sent before Day 18's reveal rule
    tests: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list)
    hints: Mapped[list[str]] = mapped_column(JSONB, default=list)
    run_mode: Mapped[RunMode] = mapped_column(_enum(RunMode, "run_mode"), default=RunMode.browser)


class Submission(UUIDPk, Timestamps, Base):
    __tablename__ = "submissions"
    __table_args__ = (
        Index("ix_submissions_user_id_exercise_id_created_at", "user_id", "exercise_id", "created_at"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    exercise_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(Text)
    status: Mapped[SubmissionStatus] = mapped_column(_enum(SubmissionStatus, "submission_status"))
    result: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict)
    runtime_ms: Mapped[int] = mapped_column(Integer, default=0)
    # Browser runs are reported by the learner's own device, so they are never verified.
    # Only a server-side re-run (v2 sandbox) may set this; certificates must require it.
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
