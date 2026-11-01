"""Shapes for the AI roadmap generator.

The LLM's output is untrusted input, exactly like a form post. It is validated here with the
same graph rules as official content (unique keys, real edges, no cycles) plus rules of its own:
8-30 topics and no links anywhere, because links are built by our backend, never by the model.
"""

import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.roadmaps.content import assert_acyclic
from app.modules.roadmaps.models import Level

MIN_NODES, MAX_NODES = 8, 30

# Anything that looks like a link or markup. Summaries are shown as Markdown on topic pages.
_UNSAFE_TEXT = re.compile(r"://|www\.|\]\(|[<>]|javascript:|data:", re.IGNORECASE)


def slugify(value: str, max_len: int = 60) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:max_len].rstrip("-")


class GenerateIn(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    goal: str = Field(min_length=10, max_length=300)
    level: Level
    hours_per_week: int = Field(ge=1, le=40)


class QuotaOut(BaseModel):
    remaining: int
    limit: int
    resets_at: datetime


# ---------- What the LLM must return ----------


def _safe(v: str) -> str:
    if _UNSAFE_TEXT.search(v):
        raise ValueError("must be plain text without links or markup")
    return v


class GenNode(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    key: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=2, max_length=80)
    summary: str = Field(min_length=10, max_length=400)
    search_query: str = Field(min_length=2, max_length=80)
    estimated_hours: int = Field(ge=1, le=60)
    official_match: str = Field(default="", max_length=80)  # "" = no match

    @field_validator("title", "summary", "search_query")
    @classmethod
    def _plain(cls, v: str) -> str:
        return _safe(v)

    @field_validator("key")
    @classmethod
    def _key(cls, v: str) -> str:
        key = slugify(v, 60)
        if not key:
            raise ValueError("key must contain letters or digits")
        return key


class GenEdge(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    from_key: str = Field(alias="from")
    to_key: str = Field(alias="to")

    @field_validator("from_key", "to_key")
    @classmethod
    def _key(cls, v: str) -> str:
        return slugify(v, 60)


class GeneratedRoadmap(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    is_tech_goal: bool
    title: str = Field(min_length=3, max_length=80)
    description: str = Field(default="", max_length=300)
    nodes: list[GenNode] = Field(min_length=MIN_NODES, max_length=MAX_NODES)
    edges: list[GenEdge] = Field(default_factory=list, max_length=MAX_NODES * 3)

    @field_validator("title", "description")
    @classmethod
    def _plain(cls, v: str) -> str:
        return _safe(v)

    @model_validator(mode="after")
    def _graph(self) -> "GeneratedRoadmap":
        keys = [n.key for n in self.nodes]
        if len(keys) != len(set(keys)):
            raise ValueError("node keys must be unique")
        known = set(keys)
        pairs: set[tuple[str, str]] = set()
        for e in self.edges:
            if e.from_key not in known or e.to_key not in known:
                raise ValueError(f"edge {e.from_key} -> {e.to_key} points at an unknown node")
            if e.from_key != e.to_key:  # drop self-loops quietly, they carry no meaning
                pairs.add((e.from_key, e.to_key))
        assert_acyclic(keys, pairs)
        self.edges = [GenEdge(**{"from": a, "to": b}) for a, b in sorted(pairs)]
        return self


# JSON schema sent to the model (structured outputs). Kept deliberately simple: types, required
# fields and no length rules (those are enforced by the Pydantic models above).
_NODE_SCHEMA = {
    "type": "object",
    "properties": {
        "key": {"type": "string", "description": "short kebab-case id, unique in this roadmap"},
        "title": {"type": "string"},
        "summary": {"type": "string", "description": "1-2 plain sentences, no links"},
        "search_query": {"type": "string", "description": "what to search for to learn this"},
        "estimated_hours": {"type": "integer"},
        "official_match": {"type": "string", "description": "key from the official list, or empty"},
    },
    "required": ["key", "title", "summary", "search_query", "estimated_hours", "official_match"],
    "additionalProperties": False,
}
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "is_tech_goal": {"type": "boolean"},
        "title": {"type": "string"},
        "description": {"type": "string"},
        "nodes": {"type": "array", "items": _NODE_SCHEMA},
        "edges": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {"from": {"type": "string"}, "to": {"type": "string"}},
                "required": ["from", "to"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["is_tech_goal", "title", "description", "nodes", "edges"],
    "additionalProperties": False,
}
