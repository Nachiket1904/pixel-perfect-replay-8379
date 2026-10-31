import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import {
  getDashboard,
  getImplementation,
  getNode,
  searchPapers,
  updateNodeStatus,
} from "@/lib/api";
import { routeTree } from "@/routeTree.gen";

describe("day 3 routes", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it.each([
    ["/dashboard", "/dashboard"],
    ["/papers", "/papers/"],
    ["/papers/paper-attention", "/papers/$id"],
    ["/implementations/impl-attention", "/implementations/$id"],
  ])("%s matches %s", (path, routeId) => {
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });
});

describe("node detail", () => {
  it("returns content, prerequisites and the linked paper", async () => {
    const node = await getNode("python-for-ml", "py-numpy");
    expect(node.content_md).toContain("NumPy");
    expect(node.prerequisites.map((n) => n.id)).toEqual(["py-envs"]);
    expect(node.unlocks.map((n) => n.id)).toEqual(["py-linear-algebra"]);
    expect(node.linked_paper?.id).toBe("paper-numpy-001");
    expect(node.exercise?.id).toBe("ex-numpy-zscore");
  });

  it("throws NOT_FOUND for an unknown topic", async () => {
    await expect(getNode("python-for-ml", "nope")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("dashboard", () => {
  it("suggests the in-progress topic first", async () => {
    const dashboard = await getDashboard();
    const python = dashboard.active.find((a) => a.roadmap.slug === "python-for-ml");
    expect(python?.next_node?.id).toBe("py-envs");
  });

  it("shows a roadmap once the learner starts it", async () => {
    await updateNodeStatus("roadmap-ml-engineer", "ml-math", "done");
    const dashboard = await getDashboard();
    const ml = dashboard.active.find((a) => a.roadmap.slug === "ml-engineer");
    expect(ml?.roadmap.progress).toEqual({ done: 1, total: 10 });
    // ml-python has no prerequisites and isn't started, so it's next.
    expect(ml?.next_node?.id).toBe("ml-python");
  });
});

describe("papers", () => {
  it("searches by title and filters by category", async () => {
    expect((await searchPapers({ q: "attention" })).map((p) => p.id)).toEqual(["paper-attention"]);
    expect((await searchPapers({ category: "cs.CV" })).map((p) => p.id)).toEqual(["paper-resnet"]);
  });

  it("never ships reference solutions to the browser", async () => {
    const impl = await getImplementation("impl-attention");
    for (const step of impl.steps) expect(step).not.toHaveProperty("solution_code");
  });
});
