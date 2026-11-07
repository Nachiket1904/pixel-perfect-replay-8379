import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class AnalyzeIn(BaseModel):
    url: str = Field(min_length=3, max_length=300)


class RepoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    owner: str
    name: str
    full_name: str
    description: str | None
    default_branch: str | None
    commit_sha: str | None
    stars: int
    sync_status: str
    sync_error: str | None
    last_synced_at: datetime | None


class StructureOut(BaseModel):
    repo: RepoOut
    analysis: dict[str, Any]  # shape documented in analyzer.build_structure


class FileOut(BaseModel):
    path: str
    content: str
    truncated: bool
