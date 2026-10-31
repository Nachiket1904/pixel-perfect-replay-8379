"""Sync official roadmaps from packages/content into the database.

    uv run python -m app.modules.roadmaps.seed            # default content folder
    uv run python -m app.modules.roadmaps.seed --check    # validate only, no DB (used in CI)

Idempotent: run it after every content change. Nodes are matched by key, so a learner's
progress on a node survives edits to its text. Nodes removed from the file are deleted.
"""

import argparse
import asyncio
import logging
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models  # noqa: F401  (registers every table, e.g. users for the owner FK)
from app.core.db import SessionLocal, engine
from app.modules.roadmaps.content import RoadmapIn, load_roadmap_dir
from app.modules.roadmaps.models import (
    Roadmap,
    RoadmapEdge,
    RoadmapNode,
    RoadmapSource,
    Visibility,
)

log = logging.getLogger("seed")

# apps/api/app/modules/roadmaps/seed.py -> repo root is 5 levels up
DEFAULT_CONTENT_DIR = Path(__file__).resolve().parents[5] / "packages" / "content" / "roadmaps"


def discover(content_dir: Path) -> list[RoadmapIn]:
    dirs = sorted(p for p in content_dir.iterdir() if (p / "roadmap.json").is_file())
    if not dirs:
        raise SystemExit(f"No roadmaps found in {content_dir}")
    return [load_roadmap_dir(d) for d in dirs]


async def upsert_official(session: AsyncSession, data: RoadmapIn) -> Roadmap:
    roadmap = await session.scalar(
        select(Roadmap)
        .where(Roadmap.slug == data.slug)
        .options(selectinload(Roadmap.nodes), selectinload(Roadmap.edges))
    )
    if roadmap is None:
        roadmap = Roadmap(slug=data.slug, source=RoadmapSource.official, nodes=[], edges=[])
        session.add(roadmap)
    elif roadmap.source != RoadmapSource.official:
        raise SystemExit(f"Slug {data.slug!r} belongs to a non-official roadmap; rename the content.")

    roadmap.title = data.title
    roadmap.description = data.description
    roadmap.level = data.level
    roadmap.estimated_hours = data.estimated_hours
    roadmap.visibility = Visibility.public
    roadmap.owner_id = None

    # 1) Edges hold no user data: drop them and rebuild at the end.
    roadmap.edges.clear()
    await session.flush()

    # 2) Update nodes in place by key (keeps their ids, so progress rows stay attached).
    existing = {n.key: n for n in roadmap.nodes}
    for position, n in enumerate(data.nodes):
        node = existing.pop(n.key, None)
        if node is None:
            node = RoadmapNode(key=n.key)
            roadmap.nodes.append(node)
        node.title = n.title
        node.summary = n.summary
        node.node_type = n.node_type
        node.position_x = n.x
        node.position_y = n.y
        node.sort_order = position
        node.content_md = n.content_md
        node.resources = [r.model_dump(mode="json") for r in n.resources]
    for removed in existing.values():
        log.warning("%s: removing node %r (no longer in content)", data.slug, removed.key)
        roadmap.nodes.remove(removed)
    await session.flush()  # assigns ids to new nodes

    # 3) Rebuild edges from keys.
    ids = {n.key: n.id for n in roadmap.nodes}
    for e in data.edges:
        roadmap.edges.append(RoadmapEdge(from_node_id=ids[e.from_key], to_node_id=ids[e.to_key], kind=e.kind))
    await session.flush()
    return roadmap


async def run(content_dir: Path, check_only: bool) -> None:
    roadmaps = discover(content_dir)  # validate everything before touching the database
    for r in roadmaps:
        log.info("valid: %s (%d nodes, %d edges)", r.slug, len(r.nodes), len(r.edges))
    if check_only:
        return

    async with SessionLocal() as session:
        for data in roadmaps:
            await upsert_official(session, data)
        await session.commit()  # all roadmaps or none
    await engine.dispose()
    log.info("seeded %d roadmaps", len(roadmaps))


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("content_dir", nargs="?", type=Path, default=DEFAULT_CONTENT_DIR)
    parser.add_argument("--check", action="store_true", help="validate content only")
    args = parser.parse_args()
    asyncio.run(run(args.content_dir, args.check))


if __name__ == "__main__":
    main()
