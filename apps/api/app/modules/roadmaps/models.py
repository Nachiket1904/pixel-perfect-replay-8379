import enum
import uuid
from typing import Any

from sqlalchemy import Enum, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, Timestamps, UUIDPk


class RoadmapSource(enum.StrEnum):
    official = "official"  # hand-written in packages/content, synced by the seed script
    ai = "ai"  # generated from a learner's goal (Day 19+)


class Level(enum.StrEnum):
    beginner = "beginner"
    intermediate = "intermediate"
    advanced = "advanced"


class Visibility(enum.StrEnum):
    public = "public"
    private = "private"


class NodeType(enum.StrEnum):
    topic = "topic"
    milestone = "milestone"


class EdgeKind(enum.StrEnum):
    prerequisite = "prerequisite"
    optional = "optional"


def _enum(e: type[enum.Enum], name: str) -> Enum:
    return Enum(e, name=name, values_callable=lambda members: [m.value for m in members])


class Roadmap(UUIDPk, Timestamps, Base):
    __tablename__ = "roadmaps"

    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    source: Mapped[RoadmapSource] = mapped_column(_enum(RoadmapSource, "roadmap_source"))
    level: Mapped[Level] = mapped_column(_enum(Level, "roadmap_level"))
    estimated_hours: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    visibility: Mapped[Visibility] = mapped_column(
        _enum(Visibility, "roadmap_visibility"),
        default=Visibility.public,
        server_default=Visibility.public.value,
    )
    # Null for official roadmaps; the learner for AI roadmaps. Deleting a user deletes their roadmaps.
    owner_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    goal_prompt: Mapped[str | None] = mapped_column(Text)

    nodes: Mapped[list["RoadmapNode"]] = relationship(
        back_populates="roadmap",
        cascade="all, delete-orphan",
        order_by="RoadmapNode.sort_order",
        lazy="raise",  # async: always load explicitly with selectinload(), never by accident
    )
    edges: Mapped[list["RoadmapEdge"]] = relationship(
        cascade="all, delete-orphan", lazy="raise", passive_deletes=True
    )


class RoadmapNode(UUIDPk, Timestamps, Base):
    __tablename__ = "roadmap_nodes"
    __table_args__ = (UniqueConstraint("roadmap_id", "key", name="uq_roadmap_nodes_roadmap_id_key"),)

    # No separate index: the unique (roadmap_id, key) constraint already serves roadmap_id lookups.
    roadmap_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"))
    # Stable, readable id used in URLs (/roadmaps/python-for-ml/py-numpy). Unique per roadmap.
    key: Mapped[str] = mapped_column(String(80))
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, default="", server_default="")
    node_type: Mapped[NodeType] = mapped_column(
        _enum(NodeType, "roadmap_node_type"), default=NodeType.topic, server_default=NodeType.topic.value
    )
    position_x: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    position_y: Mapped[float] = mapped_column(Float, default=0.0, server_default="0")
    sort_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    content_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    # [{title, url, kind, is_free}], validated by content.ResourceIn before it is stored.
    resources: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, default=list, server_default="[]")

    roadmap: Mapped[Roadmap] = relationship(back_populates="nodes", lazy="raise")


class RoadmapEdge(UUIDPk, Timestamps, Base):
    __tablename__ = "roadmap_edges"
    __table_args__ = (
        UniqueConstraint(
            "roadmap_id", "from_node_id", "to_node_id", name="uq_roadmap_edges_roadmap_id_from_to"
        ),
    )

    roadmap_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roadmaps.id", ondelete="CASCADE"))
    from_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roadmap_nodes.id", ondelete="CASCADE"))
    to_node_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roadmap_nodes.id", ondelete="CASCADE"))
    kind: Mapped[EdgeKind] = mapped_column(
        _enum(EdgeKind, "roadmap_edge_kind"),
        default=EdgeKind.prerequisite,
        server_default=EdgeKind.prerequisite.value,
    )
