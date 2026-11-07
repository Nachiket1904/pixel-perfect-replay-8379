import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class AnalyzeIn(BaseModel):
    url: str = Field(min_length=3, max_length=300)


class _ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class RepoOut(_ORM):
    id: uuid.UUID
    owner: str
    name: str
    full_name: str
    description: str | None
    default_branch: str | None
    stars: int
    sync_status: str
    sync_error: str | None
    last_synced_at: datetime | None


class BranchOut(_ORM):
    name: str
    head_sha: str
    is_default: bool


class TagOut(_ORM):
    name: str
    sha: str
    released_at: datetime | None


class CommitOut(_ORM):
    sha: str
    message: str
    author_name: str
    author_login: str | None
    committed_at: datetime
    parent_shas: list[str]


class GraphOut(BaseModel):
    repo: RepoOut
    branches: list[BranchOut]
    tags: list[TagOut]
    commits: list[CommitOut]
