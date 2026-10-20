import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { generateRoadmap, getRoadmap } from "@/lib/api";
import { topologicalLevels } from "@/lib/graph";
import { ApiError } from "@/lib/types";
import { routeTree } from "@/routeTree.gen";

describe("routes", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it.each([
    ["/roadmaps", "/roadmaps/"],
    ["/roadmaps/python-for-ml", "/roadmaps/$slug/"],
    ["/roadmaps/python-for-ml/py-numpy", "/roadmaps/$slug/$nodeId"],
    ["/papers/abc", "/papers/$id"],
    ["/build", "/build"],
  ])("%s matches %s", (path, routeId) => {
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });
});

describe("topologicalLevels", () => {
  it("puts every node in exactly one level, prerequisites first", async () => {
    const roadmap = await getRoadmap("python-for-ml");
    const levels = topologicalLevels(roadmap.nodes, roadmap.edges);
    const flat = levels.flat().map((n) => n.id);
    expect(flat).toHaveLength(roadmap.nodes.length);
    expect(new Set(flat).size).toBe(roadmap.nodes.length);
    for (const e of roadmap.edges) {
      expect(flat.indexOf(e.from_node_id)).toBeLessThan(flat.indexOf(e.to_node_id));
    }
  });
});

describe("generateRoadmap mock", () => {
  it("rejects non-tech goals", async () => {
    await expect(
      generateRoadmap({
        goal: "I want to learn cricket batting",
        level: "beginner",
        hours_per_week: 6,
      }),
    ).rejects.toMatchObject({ code: "NON_TECH_GOAL" } satisfies Partial<ApiError>);
  });
});
