// Pure layout for the commit graph: assigns each commit a row and a lane (column).
// No React here, so it is easy to unit test.

export type GraphCommit = { sha: string; parent_shas: string[]; committed_at: string };

export type GraphNode<T extends GraphCommit> = { commit: T; row: number; lane: number };

export type GraphEdge = {
  fromRow: number;
  fromLane: number;
  toRow: number;
  toLane: number;
  /** "first": child continues down its lane and joins the parent at the end.
   *  "merge": a merge commit's extra parent; bends out right away, then runs down. */
  kind: "first" | "merge";
};

export type GraphLayout<T extends GraphCommit> = {
  nodes: GraphNode<T>[];
  edges: GraphEdge[];
  laneCount: number;
};

/** Children always come before their parents; among commits that are ready, newest first. */
export function topoOrder<T extends GraphCommit>(commits: T[]): T[] {
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const pendingChildren = new Map<string, number>(commits.map((c) => [c.sha, 0]));
  for (const c of commits) {
    for (const p of c.parent_shas) {
      if (bySha.has(p)) pendingChildren.set(p, pendingChildren.get(p)! + 1);
    }
  }
  const time = (c: T) => Date.parse(c.committed_at) || 0;
  const ready = commits.filter((c) => pendingChildren.get(c.sha) === 0);
  const out: T[] = [];
  while (ready.length > 0) {
    let best = 0;
    for (let i = 1; i < ready.length; i++) if (time(ready[i]) > time(ready[best])) best = i;
    const [c] = ready.splice(best, 1);
    out.push(c);
    for (const p of c.parent_shas) {
      if (!bySha.has(p)) continue;
      const left = pendingChildren.get(p)! - 1;
      pendingChildren.set(p, left);
      if (left === 0) ready.push(bySha.get(p)!);
    }
  }
  return out;
}

export function layoutGraph<T extends GraphCommit>(commits: T[]): GraphLayout<T> {
  const ordered = topoOrder(commits);
  const rowOf = new Map(ordered.map((c, i) => [c.sha, i]));
  const lanes: (string | null)[] = []; // lanes[i] = sha this lane is waiting for
  const laneOf = new Map<string, number>();
  const nodes: GraphNode<T>[] = [];

  const freeLane = () => {
    const i = lanes.indexOf(null);
    if (i !== -1) return i;
    lanes.push(null);
    return lanes.length - 1;
  };

  ordered.forEach((commit, row) => {
    let lane = lanes.indexOf(commit.sha);
    if (lane === -1) lane = freeLane();
    // Any other lane waiting for this commit ends here (a branch joining back).
    for (let i = 0; i < lanes.length; i++) if (i !== lane && lanes[i] === commit.sha) lanes[i] = null;
    laneOf.set(commit.sha, lane);
    nodes.push({ commit, row, lane });

    const parents = commit.parent_shas.filter((p) => rowOf.has(p));
    lanes[lane] = parents[0] ?? null;
    for (const p of parents.slice(1)) {
      if (!lanes.includes(p)) lanes[freeLane()] = p;
    }
  });

  const edges: GraphEdge[] = [];
  for (const { commit, row, lane } of nodes) {
    commit.parent_shas.forEach((p, i) => {
      const toRow = rowOf.get(p);
      if (toRow === undefined) return; // parent is older than the commits we loaded
      edges.push({ fromRow: row, fromLane: lane, toRow, toLane: laneOf.get(p)!, kind: i === 0 ? "first" : "merge" });
    });
  }

  const laneCount = nodes.reduce((max, n) => Math.max(max, n.lane + 1), 0);
  return { nodes, edges, laneCount };
}

/** Commits reachable from a branch head (the branch filter). */
export function reachableFrom<T extends GraphCommit>(commits: T[], headSha: string): Set<string> {
  const bySha = new Map(commits.map((c) => [c.sha, c]));
  const seen = new Set<string>();
  const stack = [headSha];
  while (stack.length > 0) {
    const sha = stack.pop()!;
    const c = bySha.get(sha);
    if (!c || seen.has(sha)) continue;
    seen.add(sha);
    stack.push(...c.parent_shas);
  }
  return seen;
}
