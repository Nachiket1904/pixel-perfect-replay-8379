import { Link, createFileRoute } from "@tanstack/react-router";
import { Clock, LayoutList, Network, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { NodeSheet } from "@/components/roadmap/node-sheet";
import { RoadmapGraph } from "@/components/roadmap/roadmap-graph";
import { RoadmapList } from "@/components/roadmap/roadmap-list";
import { SourceBadge } from "@/components/roadmap/source-badge";
import { levelLabel, statusDotClass, statusLabel } from "@/components/roadmap/status";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoadmap, useUpdateNodeStatus } from "@/lib/queries";
import { ApiError, type NodeStatus, type Roadmap } from "@/lib/types";

export const Route = createFileRoute("/roadmaps/$slug/")({
  // Real titles come on Day 9 when this page loads data from the API on the server.
  head: () => ({ meta: [{ title: "Roadmap | PadhLo With Us" }] }),
  component: RoadmapPage,
});

function RoadmapPage() {
  const { slug } = Route.useParams();
  const roadmap = useRoadmap(slug);

  if (roadmap.isPending) return <RoadmapSkeleton />;

  if (roadmap.isError) {
    const notFound = roadmap.error instanceof ApiError && roadmap.error.code === "NOT_FOUND";
    return (
      <div className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {notFound ? "Roadmap not found" : "Couldn't load this roadmap"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {notFound
            ? "It may have been removed, or the link is wrong."
            : "Please check your connection and try again."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          {!notFound && <Button onClick={() => void roadmap.refetch()}>Try again</Button>}
          <Button variant="outline" asChild>
            <Link to="/roadmaps">All roadmaps</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <RoadmapView roadmap={roadmap.data} />;
}

function RoadmapView({ roadmap }: { roadmap: Roadmap }) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<"graph" | "list">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const updateStatus = useUpdateNodeStatus(roadmap);

  // Default: list on phones, graph on larger screens. Runs after mount (no SSR mismatch).
  useEffect(() => setView(isMobile ? "list" : "graph"), [isMobile]);

  const done = roadmap.nodes.filter((n) => n.status === "done").length;
  const total = roadmap.nodes.length;
  const percent = Math.round((done / Math.max(1, total)) * 100);
  const selected = roadmap.nodes.find((n) => n.id === selectedId) ?? null;

  const onStatusChange = (nodeId: string, status: NodeStatus) => {
    updateStatus.mutate(
      { nodeId, status },
      { onError: () => toast.error("Couldn't save your progress. Please try again.") },
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <SourceBadge source={roadmap.source} />
          <span className="text-sm text-muted-foreground">{levelLabel[roadmap.level]}</span>
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-3.5" aria-hidden="true" />~{roadmap.estimated_hours} h
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {roadmap.title}
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">{roadmap.description}</p>

        {roadmap.source === "ai" && (
          <div className="mt-4 max-w-3xl rounded-lg border border-warning/50 bg-accent/60 p-4 text-sm">
            {roadmap.goal_prompt && (
              <p className="text-foreground">
                <span className="font-semibold">Your goal:</span> {roadmap.goal_prompt}
              </p>
            )}
            <p className="mt-1 flex items-center gap-1.5 text-accent-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" />
              AI-generated roadmap. Topics may be imperfect.
            </p>
          </div>
        )}

        <div className="mt-6 max-w-md">
          <div className="flex justify-between text-sm">
            <span className="font-medium text-foreground">
              {done} of {total} topics done
            </span>
            <span className="text-muted-foreground">{percent}%</span>
          </div>
          <Progress
            value={percent}
            className="mt-2 h-2.5 [&>div]:bg-warning"
            aria-label={`${percent}% complete`}
          />
        </div>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <Legend />
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => v && setView(v as "graph" | "list")}
          variant="outline"
          aria-label="Roadmap view"
        >
          <ToggleGroupItem value="graph" aria-label="Graph view">
            <Network className="mr-1.5 size-4" />
            Graph
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <LayoutList className="mr-1.5 size-4" />
            List
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="mt-4">
        {view === "graph" ? (
          <RoadmapGraph roadmap={roadmap} onSelect={setSelectedId} />
        ) : (
          <RoadmapList roadmap={roadmap} onSelect={setSelectedId} />
        )}
      </div>

      <NodeSheet
        slug={roadmap.slug}
        node={selected}
        onClose={() => setSelectedId(null)}
        onStatusChange={onStatusChange}
      />
    </div>
  );
}

function Legend() {
  const items: NodeStatus[] = ["not_started", "in_progress", "done"];
  return (
    <ul className="flex flex-wrap gap-4 text-sm text-muted-foreground">
      {items.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span className={`size-3 rounded-full ${statusDotClass[s]}`} aria-hidden="true" />
          {statusLabel[s]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="h-0 w-5 border-t-2 border-dashed border-primary" aria-hidden="true" />{" "}
        Optional
      </li>
    </ul>
  );
}

function RoadmapSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 h-9 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-6 h-2.5 w-80" />
      <Skeleton className="mt-8 h-[60vh] w-full" />
    </div>
  );
}
