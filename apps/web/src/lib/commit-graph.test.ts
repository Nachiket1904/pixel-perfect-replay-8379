import { describe, expect, it } from "vitest";
import { layoutGraph, reachableFrom, topoOrder, type GraphCommit } from "./commit-graph";

const c = (sha: string, parents: string[], day: number): GraphCommit => ({
  sha,
  parent_shas: parents,
  committed_at: new Date(Date.UTC(2026, 0, day)).toISOString(),
});

describe("topoOrder", () => {
  it("puts children before parents even when clocks are wrong", () => {
    // child "b" has an OLDER timestamp than its parent "a"
    const order = topoOrder([c("a", [], 5), c("b", ["a"], 1)]).map((x) => x.sha);
    expect(order).toEqual(["b", "a"]);
  });
});

describe("layoutGraph", () => {
  it("keeps a linear history in one lane", () => {
    const g = layoutGraph([c("c", ["b"], 3), c("b", ["a"], 2), c("a", [], 1)]);
    expect(g.laneCount).toBe(1);
    expect(g.nodes.map((n) => n.lane)).toEqual([0, 0, 0]);
    expect(g.edges).toHaveLength(2);
  });

  it("opens a second lane for a feature branch and closes it at the merge", () => {
    //   m (merge of b and f)
    //   |\
    //   b f
    //   |/
    //   a
    const g = layoutGraph([c("m", ["b", "f"], 4), c("f", ["a"], 3), c("b", ["a"], 2), c("a", [], 1)]);
    const lane = Object.fromEntries(g.nodes.map((n) => [n.commit.sha, n.lane]));
    expect(lane.m).toBe(0);
    expect(lane.b).toBe(0);
    expect(lane.f).toBe(1);
    expect(lane.a).toBe(0);
    expect(g.laneCount).toBe(2);
    expect(g.edges.filter((e) => e.kind === "merge")).toHaveLength(1);
  });

  it("ignores parents outside the loaded window", () => {
    const g = layoutGraph([c("b", ["a"], 2)]);
    expect(g.edges).toHaveLength(0);
  });
});

describe("reachableFrom", () => {
  it("walks parents from a branch head", () => {
    const commits = [c("x", ["a"], 3), c("b", ["a"], 2), c("a", [], 1)];
    expect([...reachableFrom(commits, "x")].sort()).toEqual(["a", "x"]);
  });
});
