from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.modules.roadmaps.schemas import NodeRef, NodeStatus, RoadmapSummaryOut


class StatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: NodeStatus


class StatusOut(BaseModel):
    node_id: str  # node key
    status: NodeStatus
    done: int
    total: int


class ActiveRoadmapOut(BaseModel):
    roadmap: RoadmapSummaryOut
    next_node: NodeRef | None


class DashboardOut(BaseModel):
    active: list[ActiveRoadmapOut]
    streak_days: int
    activity: Literal["today", "yesterday", "lapsed", "never"]
