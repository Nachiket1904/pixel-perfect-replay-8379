import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    false,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.modules.github.deps import Base


class Repo(Base):
    __tablename__ = "repos"
    __table_args__ = (UniqueConstraint("owner", "name", name="uq_repos_owner_name"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner: Mapped[str] = mapped_column(String(100))  # lowercased, used for lookups
    name: Mapped[str] = mapped_column(String(100))
    full_name: Mapped[str] = mapped_column(String(201))  # display form from GitHub
    github_id: Mapped[int | None] = mapped_column(BigInteger)
    description: Mapped[str | None] = mapped_column(Text)
    default_branch: Mapped[str | None] = mapped_column(String(255))
    stars: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    # pending | syncing | ok | failed
    sync_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    sync_error: Mapped[str | None] = mapped_column(Text)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class RepoBranch(Base):
    __tablename__ = "repo_branches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("repos.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    head_sha: Mapped[str] = mapped_column(String(40))
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class RepoTag(Base):
    __tablename__ = "repo_tags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("repos.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(255))
    sha: Mapped[str] = mapped_column(String(40))
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RepoCommit(Base):
    __tablename__ = "repo_commits"
    __table_args__ = (
        UniqueConstraint("repo_id", "sha", name="uq_repo_commits_repo_sha"),
        Index("ix_repo_commits_repo_committed", "repo_id", "committed_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    repo_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("repos.id", ondelete="CASCADE"))
    sha: Mapped[str] = mapped_column(String(40))
    message: Mapped[str] = mapped_column(Text)
    author_name: Mapped[str] = mapped_column(String(255))
    author_login: Mapped[str | None] = mapped_column(String(100))
    committed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    parent_shas: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
