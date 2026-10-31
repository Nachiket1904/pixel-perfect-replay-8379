"""Validation for roadmap content files (packages/content/roadmaps/<slug>/).

Layout of one roadmap:
    roadmap.json          metadata, nodes (without long text) and edges
    nodes/<key>.md        optional long-form content for a node

Everything is validated here before it touches the database, so a typo in a content file
fails the seed loudly instead of shipping a broken roadmap. The same rules (unique keys,
edges point at real nodes, no cycles) will validate AI-generated roadmaps later.
"""

import json
from collections import deque
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from app.modules.roadmaps.models import EdgeKind, Level, NodeType

KEY_PATTERN = r"^[a-z0-9][a-z0-9-]{0,79}$"
SLUG_PATTERN = r"^[a-z0-9][a-z0-9-]{0,119}$"
MAX_CONTENT_CHARS = 20_000


class ResourceIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=200)
    url: HttpUrl
    kind: Literal["docs", "video", "article", "course", "search"]
    is_free: bool = True

    @field_validator("url")
    @classmethod
    def _https_only(cls, v: HttpUrl) -> HttpUrl:
        if v.scheme != "https":
            raise ValueError("Resource links must use https://")
        return v


class NodeIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    key: str = Field(pattern=KEY_PATTERN)
    title: str = Field(min_length=1, max_length=200)
    summary: str = Field(default="", max_length=1000)
    node_type: NodeType = NodeType.topic
    x: float = 0
    y: float = 0
    resources: list[ResourceIn] = Field(default_factory=list, max_length=20)
    content_md: str = Field(default="", max_length=MAX_CONTENT_CHARS)


class EdgeIn(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    from_key: str = Field(alias="from")
    to_key: str = Field(alias="to")
    kind: EdgeKind = EdgeKind.prerequisite


class RoadmapIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    slug: str = Field(pattern=SLUG_PATTERN)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=2000)
    level: Level
    estimated_hours: int = Field(ge=1, le=2000)
    nodes: list[NodeIn] = Field(min_length=1, max_length=200)
    edges: list[EdgeIn] = Field(default_factory=list, max_length=600)

    @model_validator(mode="after")
    def _graph_is_valid(self) -> "RoadmapIn":
        keys = [n.key for n in self.nodes]
        duplicates = {k for k in keys if keys.count(k) > 1}
        if duplicates:
            raise ValueError(f"Duplicate node keys: {sorted(duplicates)}")
        known = set(keys)
        pairs: set[tuple[str, str]] = set()
        for e in self.edges:
            if e.from_key not in known or e.to_key not in known:
                raise ValueError(f"Edge {e.from_key} -> {e.to_key} points at an unknown node")
            if e.from_key == e.to_key:
                raise ValueError(f"Edge {e.from_key} -> {e.to_key} points at itself")
            if (e.from_key, e.to_key) in pairs:
                raise ValueError(f"Duplicate edge {e.from_key} -> {e.to_key}")
            pairs.add((e.from_key, e.to_key))
        assert_acyclic(keys, pairs)
        return self


def assert_acyclic(keys: list[str], edges: set[tuple[str, str]]) -> None:
    """Kahn's algorithm: if we can't order every node, there is a cycle (A needs B needs A)."""
    indegree = dict.fromkeys(keys, 0)
    children: dict[str, list[str]] = {k: [] for k in keys}
    for a, b in edges:
        children[a].append(b)
        indegree[b] += 1
    queue = deque(k for k, d in indegree.items() if d == 0)
    seen = 0
    while queue:
        k = queue.popleft()
        seen += 1
        for child in children[k]:
            indegree[child] -= 1
            if indegree[child] == 0:
                queue.append(child)
    if seen != len(keys):
        stuck = sorted(k for k, d in indegree.items() if d > 0)
        raise ValueError(f"Prerequisites form a cycle around: {stuck}")


def load_roadmap_dir(directory: Path) -> RoadmapIn:
    """Read roadmap.json plus nodes/<key>.md files and validate them together."""
    raw = json.loads((directory / "roadmap.json").read_text(encoding="utf-8"))
    nodes_dir = directory / "nodes"
    for node in raw.get("nodes", []):
        md_file = nodes_dir / f"{node.get('key', '')}.md"
        if md_file.is_file():
            if node.get("content_md"):
                raise ValueError(f"{node['key']}: content is both inline and in {md_file.name}")
            node["content_md"] = md_file.read_text(encoding="utf-8").strip()
    roadmap = RoadmapIn.model_validate(raw)
    if roadmap.slug != directory.name:
        raise ValueError(f"Folder name {directory.name!r} must match slug {roadmap.slug!r}")
    return roadmap
