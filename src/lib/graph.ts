import type { RoadmapEdge, RoadmapNode } from "@/lib/types";

/**
 * Groups nodes into levels using Kahn's algorithm: level 0 has no prerequisites,
 * level n depends only on earlier levels. Nodes in a cycle (should never happen,
 * the backend validates DAGs) are appended as a final level so nothing disappears.
 */
export function topologicalLevels(nodes: RoadmapNode[], edges: RoadmapEdge[]): RoadmapNode[][] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  const children = new Map<string, string[]>();

  for (const e of edges) {
    if (!byId.has(e.from_node_id) || !byId.has(e.to_node_id)) continue;
    indegree.set(e.to_node_id, (indegree.get(e.to_node_id) ?? 0) + 1);
    children.set(e.from_node_id, [...(children.get(e.from_node_id) ?? []), e.to_node_id]);
  }

  const levels: RoadmapNode[][] = [];
  const seen = new Set<string>();
  let current = nodes.filter((n) => indegree.get(n.id) === 0);

  while (current.length > 0) {
    // Keep left-to-right order stable inside a level.
    current.sort((a, b) => a.position.x - b.position.x);
    levels.push(current);
    const next: RoadmapNode[] = [];
    for (const n of current) {
      seen.add(n.id);
      for (const childId of children.get(n.id) ?? []) {
        const remaining = (indegree.get(childId) ?? 0) - 1;
        indegree.set(childId, remaining);
        const child = byId.get(childId);
        if (remaining === 0 && child) next.push(child);
      }
    }
    current = next;
  }

  const leftovers = nodes.filter((n) => !seen.has(n.id));
  if (leftovers.length > 0) levels.push(leftovers);
  return levels;
}
