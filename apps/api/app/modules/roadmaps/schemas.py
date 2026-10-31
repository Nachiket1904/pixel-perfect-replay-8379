"""Response shapes. They mirror apps/web/src/lib/types.ts field for field (snake_case)."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.modules.roadmaps.models import EdgeKind, Level, NodeType, RoadmapSource

NodeStatus = Literal["not_started", "in_progress", "done"]


class ProgressOut(BaseModel):
    done: int
    total: int


class RoadmapSummaryOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str
    source: RoadmapSource
    level: Level
    node_count: int
    estimated_hours: int
    progress: ProgressOut | None = None  # filled in on Day 11


class Position(BaseModel):
    x: float
    y: float


class NodeOut(BaseModel):
    id: str  # the node key, e.g. "py-numpy" (unique within its roadmap, used in URLs)
    title: str
    summary: str
    node_type: NodeType
    position: Position
    status: NodeStatus = "not_started"  # per-user status arrives on Day 11
    has_exercise: bool = False  # exercises arrive on Day 17
    linked_paper_id: str | None = None  # papers arrive on Day 23


class EdgeOut(BaseModel):
    id: uuid.UUID
    from_node_id: str  # node key
    to_node_id: str  # node key
    kind: EdgeKind


class RoadmapOut(RoadmapSummaryOut):
    goal_prompt: str | None
    nodes: list[NodeOut]
    edges: list[EdgeOut]
    created_at: datetime
