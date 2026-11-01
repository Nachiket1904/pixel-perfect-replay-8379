import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

MAX_CODE_CHARS = 20_000


class TestCaseOut(BaseModel):
    name: str
    code: str


class ExerciseOut(BaseModel):
    """What the topic page needs. Never includes the solution."""

    id: uuid.UUID
    title: str
    language: Literal["python"]
    prompt_md: str
    starter_code: str
    tests: list[TestCaseOut]
    hints_count: int


class TestResultIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=120)
    passed: bool
    message: str = Field(default="", max_length=2000)


class SubmissionIn(BaseModel):
    """A browser run reported by the client. Stored as unverified."""

    model_config = ConfigDict(extra="forbid")

    code: str = Field(max_length=MAX_CODE_CHARS)
    status: Literal["passed", "failed", "error"]
    results: list[TestResultIn] = Field(default_factory=list, max_length=20)
    error: str | None = Field(default=None, max_length=5000)
    runtime_ms: int = Field(ge=0, le=120_000)


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: Literal["passed", "failed", "error"]
    code: str
    results: list[TestResultIn]
    error: str | None
    runtime_ms: int
    verified: bool
    created_at: datetime


class SubmissionsSummary(BaseModel):
    latest: SubmissionOut | None
    attempts: int
    passed_ever: bool
