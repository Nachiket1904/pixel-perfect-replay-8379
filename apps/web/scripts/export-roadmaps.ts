// One-off (Day 8): turn the official mock roadmaps into content files the API seeds from.
//   cd apps/web && bun scripts/export-roadmaps.ts
// After this, packages/content is the source of truth; edit the files there, not the mocks.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { mockNodeContent } from "../src/lib/mock-content";
import { mockRoadmaps } from "../src/lib/mock-data";

const outDir = join(import.meta.dirname, "../../../packages/content/roadmaps");

for (const roadmap of mockRoadmaps.filter((r) => r.source === "official")) {
  const dir = join(outDir, roadmap.slug);
  mkdirSync(join(dir, "nodes"), { recursive: true });

  const nodes = roadmap.nodes.map((n) => {
    const content = mockNodeContent[n.id];
    if (content?.content_md)
      writeFileSync(join(dir, "nodes", `${n.id}.md`), `${content.content_md}\n`);
    return {
      key: n.id,
      title: n.title,
      summary: n.summary,
      node_type: n.node_type,
      x: n.position.x,
      y: n.position.y,
      resources: content?.resources ?? [],
    };
  });

  const file = {
    slug: roadmap.slug,
    title: roadmap.title,
    description: roadmap.description,
    level: roadmap.level,
    estimated_hours: roadmap.estimated_hours,
    nodes,
    edges: roadmap.edges.map((e) => ({ from: e.from_node_id, to: e.to_node_id, kind: e.kind })),
  };
  writeFileSync(join(dir, "roadmap.json"), `${JSON.stringify(file, null, 2)}\n`);
  console.log(`exported ${roadmap.slug}: ${nodes.length} nodes, ${file.edges.length} edges`);
}
