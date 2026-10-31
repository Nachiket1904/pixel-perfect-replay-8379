import enum
import uuid

from sqlalchemy import Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base, Timestamps


class NodeStatus(enum.StrEnum):
    # "not_started" is never stored: no row means not started, so un-marking deletes the row.
    in_progress = "in_progress"
    done = "done"


class UserNodeProgress(Timestamps, Base):
    __tablename__ = "user_node_progress"
    __table_args__ = (Index("ix_user_node_progress_user_id_roadmap_id", "user_id", "roadmap_id"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="CASCADE"), primary_key=True
    )
    # Denormalised from the node so "progress on this roadmap" is one indexed lookup.
    roadmap_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"))
    status: Mapped[NodeStatus] = mapped_column(
        Enum(NodeStatus, name="node_status", values_callable=lambda e: [m.value for m in e])
    )
