"""Turn a learner's goal into a private AI roadmap.

Flow: prompt -> LLM (structured JSON) -> validate (retry once) -> match official topics ->
build resource links ourselves -> lay out the graph -> save as private to the learner.
"""

import logging
import secrets

from fastapi import status as http
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.modules.generator.llm import LLMClient, LLMRefused, LLMResult, LLMUnavailable
from app.modules.generator.prompt import SYSTEM_PROMPT, resources_for, retry_prompt, user_prompt
from app.modules.generator.schemas import GeneratedRoadmap, GenerateIn, slugify
from app.modules.roadmaps import service as roadmaps
from app.modules.roadmaps.models import (
    EdgeKind,
    NodeType,
    Roadmap,
    RoadmapEdge,
    RoadmapNode,
    RoadmapSource,
    Visibility,
)
from app.modules.roadmaps.schemas import RoadmapOut
from app.modules.users.models import User

log = logging.getLogger(__name__)

MAX_LLM_CALLS = 2  # first try + one corrected retry
ROW_HEIGHT, COLUMN_WIDTH = 120, 200


def unavailable() -> AppError:
    return AppError(
        "GENERATOR_UNAVAILABLE",
        "Roadmap generation is paused right now. Start with an official roadmap instead.",
        http.HTTP_503_SERVICE_UNAVAILABLE,
    )


def non_tech() -> AppError:
    return AppError(
        "NON_TECH_GOAL",
        "We build roadmaps for technology goals. Try a programming, data or AI goal.",
        http.HTTP_422_UNPROCESSABLE_CONTENT,
    )


async def official_topics(session: AsyncSession) -> dict[str, RoadmapNode]:
    rows = await session.scalars(
        select(RoadmapNode)
        .join(Roadmap, Roadmap.id == RoadmapNode.roadmap_id)
        .where(Roadmap.source == RoadmapSource.official, Roadmap.visibility == Visibility.public)
        .order_by(Roadmap.slug, RoadmapNode.sort_order)
    )
    topics: dict[str, RoadmapNode] = {}
    for node in rows:
        if node.node_type == NodeType.topic:
            topics.setdefault(node.key, node)
    return topics


async def ask_llm(llm: LLMClient, system: str, prompt: str, on_usage) -> GeneratedRoadmap:  # noqa: ANN001
    """Call the model, validate, and retry once with the validation errors."""
    errors = ""
    for attempt in range(MAX_LLM_CALLS):
        message = prompt if attempt == 0 else f"{prompt}\n\n{retry_prompt(errors)}"
        try:
            result: LLMResult = await llm.generate(system, message)
        except LLMUnavailable as exc:
            log.warning("generator: LLM unavailable: %s", exc)
            raise unavailable() from exc
        except LLMRefused as exc:
            raise non_tech() from exc
        await on_usage(result)

        data = result.data
        if isinstance(data, dict) and data.get("is_tech_goal") is False:
            raise non_tech()
        try:
            return GeneratedRoadmap.model_validate(data)
        except ValidationError as exc:
            errors = "; ".join(f"{'.'.join(map(str, e['loc']))}: {e['msg']}" for e in exc.errors()[:8])
            log.info("generator: invalid output (attempt %d): %s", attempt + 1, errors)
    raise AppError(
        "GENERATION_FAILED",
        "We couldn't build a good roadmap for that goal. Try rewording it.",
        http.HTTP_502_BAD_GATEWAY,
    )


def layout(keys: list[str], edges: set[tuple[str, str]]) -> dict[str, tuple[float, float]]:
    """Layered layout: a topic's row is its longest prerequisite chain; rows are centred."""
    parents: dict[str, list[str]] = {k: [] for k in keys}
    for a, b in edges:
        parents[b].append(a)
    depth: dict[str, int] = {}

    def row(k: str) -> int:  # the graph is acyclic (validated), so this terminates
        if k not in depth:
            depth[k] = 1 + max((row(p) for p in parents[k]), default=-1)
        return depth[k]

    rows: dict[int, list[str]] = {}
    for k in keys:  # keep the model's order inside a row
        rows.setdefault(row(k), []).append(k)
    positions = {}
    for r, members in rows.items():
        for i, k in enumerate(members):
            positions[k] = ((i - (len(members) - 1) / 2) * COLUMN_WIDTH, r * ROW_HEIGHT)
    return positions


async def save(
    session: AsyncSession,
    user: User,
    body: GenerateIn,
    gen: GeneratedRoadmap,
    official: dict[str, RoadmapNode],
) -> Roadmap:
    edges = {(e.from_key, e.to_key) for e in gen.edges}
    keys = [n.key for n in gen.nodes]
    positions = layout(keys, edges)

    roadmap = Roadmap(
        slug=f"{slugify(gen.title, 50) or 'roadmap'}-{secrets.token_hex(3)}",
        title=gen.title,
        description=gen.description,
        source=RoadmapSource.ai,
        level=body.level,
        estimated_hours=max(1, min(2000, sum(n.estimated_hours for n in gen.nodes))),
        visibility=Visibility.private,
        owner_id=user.id,
        goal_prompt=body.goal,
        nodes=[],
        edges=[],
    )
    for order, n in enumerate(gen.nodes):
        match = official.get(n.official_match) if n.official_match else None
        x, y = positions[n.key]
        roadmap.nodes.append(
            RoadmapNode(
                key=n.key,
                title=n.title,
                summary=n.summary,
                node_type=NodeType.topic,
                position_x=x,
                position_y=y,
                sort_order=order,
                # Smart shortcut: a matched official topic brings its hand-written page with it.
                content_md=match.content_md if match else "",
                resources=list(match.resources) if match else resources_for(n.title, n.search_query),
            )
        )
    session.add(roadmap)
    await session.flush()  # node ids
    ids = {node.key: node.id for node in roadmap.nodes}
    for a, b in sorted(edges):
        roadmap.edges.append(RoadmapEdge(from_node_id=ids[a], to_node_id=ids[b], kind=EdgeKind.prerequisite))
    await session.flush()
    return roadmap


async def _no_usage(_: LLMResult) -> None:
    return None


async def generate(
    session: AsyncSession,
    user: User,
    body: GenerateIn,
    llm: LLMClient,
    on_usage=_no_usage,  # noqa: ANN001
) -> RoadmapOut:
    official = await official_topics(session)
    prompt = user_prompt(
        body.goal, body.level.value, body.hours_per_week, [(k, n.title) for k, n in official.items()]
    )
    gen = await ask_llm(llm, SYSTEM_PROMPT, prompt, on_usage)
    roadmap = await save(session, user, body, gen, official)
    await session.commit()
    log.info("generator: user %s created %s (%d topics)", user.id, roadmap.slug, len(gen.nodes))
    return await roadmaps.get_roadmap(session, user, roadmap.slug)
