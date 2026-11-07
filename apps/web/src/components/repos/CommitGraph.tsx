import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Button } from "@/components/ui/button";
import { layoutGraph, reachableFrom, type GraphEdge } from "@/lib/commit-graph";
import type { RepoBranch, RepoCommit, RepoTag } from "@/lib/repos-api";

const ROW_H = 28;
const LANE_W = 16;
const PAD = 12;
const DOT_R = 5;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
// Mid-tone colours that read on both light and dark backgrounds.
const LANE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];

type View = { x: number; y: number; k: number };
type Label = { text: string; kind: "branch" | "tag" };

const laneColor = (lane: number) => LANE_COLORS[lane % LANE_COLORS.length];
const cx = (lane: number) => PAD + lane * LANE_W + LANE_W / 2;
const cy = (row: number) => PAD + row * ROW_H + ROW_H / 2;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const firstLine = (msg: string) => msg.split("\n")[0];
const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

function edgePath(e: GraphEdge): string {
  const x1 = cx(e.fromLane);
  const y1 = cy(e.fromRow);
  const x2 = cx(e.toLane);
  const y2 = cy(e.toRow);
  if (x1 === x2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const half = ROW_H / 2;
  if (e.kind === "merge") {
    // Bend out of the merge commit right away, then run down the parent's lane.
    return `M ${x1} ${y1} C ${x1} ${y1 + half} ${x2} ${y1 + half} ${x2} ${y1 + ROW_H} L ${x2} ${y2}`;
  }
  // Run down the child's lane, then join the parent's lane on the last row.
  return `M ${x1} ${y1} L ${x1} ${y2 - ROW_H} C ${x1} ${y2 - half} ${x2} ${y2 - half} ${x2} ${y2}`;
}

type Props = {
  repoFullName: string;
  commits: RepoCommit[];
  branches: RepoBranch[];
  tags: RepoTag[];
};

export function CommitGraph({ repoFullName, commits, branches, tags }: Props) {
  const [branch, setBranch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; sha: string | null; moved: boolean } | null>(
    null,
  );

  const visible = useMemo(() => {
    const head = branches.find((b) => b.name === branch)?.head_sha;
    if (!head) return commits;
    const keep = reachableFrom(commits, head);
    return commits.filter((c) => keep.has(c.sha));
  }, [commits, branches, branch]);

  const layout = useMemo(() => layoutGraph(visible), [visible]);

  const labels = useMemo(() => {
    const map = new Map<string, Label[]>();
    const add = (sha: string, label: Label) => map.set(sha, [...(map.get(sha) ?? []), label]);
    for (const b of branches) add(b.head_sha, { text: b.name, kind: "branch" });
    for (const t of tags) add(t.sha, { text: t.name, kind: "tag" });
    return map;
  }, [branches, tags]);

  const bySha = useMemo(() => new Map(commits.map((c) => [c.sha, c])), [commits]);
  const selectedCommit = selected ? bySha.get(selected) : undefined;

  const graphWidth = PAD * 2 + Math.max(layout.laneCount, 1) * LANE_W;
  const textX = graphWidth + 8;
  const height = PAD * 2 + layout.nodes.length * ROW_H;

  // Wheel pans; ctrl/cmd + wheel (and trackpad pinch) zooms around the pointer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        setView((v) => {
          const k = clamp(v.k * (e.deltaY < 0 ? 1.1 : 1 / 1.1), MIN_ZOOM, MAX_ZOOM);
          return { k, x: px - (px - v.x) * (k / v.k), y: py - (py - v.y) * (k / v.k) };
        });
      } else {
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomBy(factor: number) {
    const el = containerRef.current;
    const w = el?.clientWidth ?? 0;
    const h = el?.clientHeight ?? 0;
    setView((v) => {
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      return { k, x: w / 2 - (w / 2 - v.x) * (k / v.k), y: h / 2 - (h / 2 - v.y) * (k / v.k) };
    });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const sha = (e.target as Element).closest("[data-sha]")?.getAttribute("data-sha") ?? null;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, sha, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved && d.sha) setSelected(d.sha);
  }

  function changeBranch(name: string) {
    setBranch(name);
    setSelected(null);
    setView({ x: 0, y: 0, k: 1 });
  }

  if (commits.length === 0) {
    return <p className="text-sm text-muted-foreground">This repository has no commits yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="branch-filter">
          Branch
        </label>
        <select
          id="branch-filter"
          value={branch}
          onChange={(e) => changeBranch(e.target.value)}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All loaded branches</option>
          {branches.map((b) => (
            <option key={b.name} value={b.name}>
              {b.name}
              {b.is_default ? " (default)" : ""}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="sm" onClick={() => zoomBy(1.25)} aria-label="Zoom in">
            +
          </Button>
          <Button variant="outline" size="sm" onClick={() => zoomBy(0.8)} aria-label="Zoom out">
            −
          </Button>
          <Button variant="outline" size="sm" onClick={() => setView({ x: 0, y: 0, k: 1 })}>
            Reset
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {visible.length} recent commits. Drag or scroll to move, ctrl + scroll or the buttons to zoom, click a commit
        for details.
      </p>

      <div
        ref={containerRef}
        className="relative h-[520px] cursor-grab touch-none select-none overflow-hidden rounded-lg border active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => (drag.current = null)}
      >
        <svg className="absolute left-0 top-0 h-full w-full" role="img" aria-label={`Commit graph of ${repoFullName}`}>
          <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
            {layout.nodes.map(({ commit, row }) => (
              <rect
                key={`bg-${commit.sha}`}
                data-sha={commit.sha}
                x={0}
                y={PAD + row * ROW_H}
                width={textX + 900}
                height={ROW_H}
                className={commit.sha === selected ? "fill-accent" : "fill-transparent"}
              />
            ))}

            {layout.edges.map((e, i) => (
              <path
                key={i}
                d={edgePath(e)}
                fill="none"
                stroke={laneColor(e.kind === "merge" ? e.toLane : e.fromLane)}
                strokeWidth={2}
                pointerEvents="none"
              />
            ))}

            {layout.nodes.map(({ commit, row, lane }) => {
              const y = cy(row);
              let cursor = textX + 58; // after the short sha
              const placed = (labels.get(commit.sha) ?? []).map((l) => {
                const w = l.text.length * 6.5 + 12;
                const at = cursor;
                cursor += w + 4;
                return { ...l, x: at, w };
              });
              return (
                <g key={commit.sha} data-sha={commit.sha}>
                  <circle
                    cx={cx(lane)}
                    cy={y}
                    r={commit.parent_shas.length > 1 ? DOT_R - 1 : DOT_R}
                    fill={laneColor(lane)}
                    className="stroke-background"
                    strokeWidth={2}
                  />
                  <text x={textX} y={y + 4} fontSize={11} className="fill-muted-foreground font-mono">
                    {commit.sha.slice(0, 7)}
                  </text>
                  {placed.map((l) => (
                    <g key={`${l.kind}-${l.text}`}>
                      <rect
                        x={l.x}
                        y={y - 9}
                        width={l.w}
                        height={18}
                        rx={l.kind === "branch" ? 9 : 3}
                        fill={laneColor(lane)}
                        fillOpacity={l.kind === "branch" ? 0.18 : 0}
                        stroke={laneColor(lane)}
                      />
                      <text x={l.x + 6} y={y + 4} fontSize={11} className="fill-foreground">
                        {l.text}
                      </text>
                    </g>
                  ))}
                  <text x={cursor} y={y + 4} fontSize={12} className="fill-foreground">
                    {truncate(firstLine(commit.message), 72)}
                    <tspan className="fill-muted-foreground">
                      {"  "}
                      {commit.author_name}, {new Date(commit.committed_at).toLocaleDateString()}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {selectedCommit && (
        <div className="space-y-2 rounded-lg border p-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <a
              href={`https://github.com/${repoFullName}/commit/${selectedCommit.sha}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-primary underline-offset-4 hover:underline"
            >
              {selectedCommit.sha.slice(0, 12)}
            </a>
            <span className="text-muted-foreground">
              {selectedCommit.author_name}
              {selectedCommit.author_login ? ` (@${selectedCommit.author_login})` : ""} committed on{" "}
              {new Date(selectedCommit.committed_at).toLocaleString()}
            </span>
          </div>
          <pre className="whitespace-pre-wrap break-words font-sans">{selectedCommit.message}</pre>
          {selectedCommit.parent_shas.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">
                {selectedCommit.parent_shas.length > 1 ? "Merge of" : "Parent"}
              </span>
              {selectedCommit.parent_shas.map((p) =>
                bySha.has(p) ? (
                  <Button key={p} variant="link" size="sm" className="h-auto p-0 font-mono" onClick={() => setSelected(p)}>
                    {p.slice(0, 7)}
                  </Button>
                ) : (
                  <code key={p} className="text-muted-foreground">
                    {p.slice(0, 7)}
                  </code>
                ),
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
