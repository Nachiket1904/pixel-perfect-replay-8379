import { Link } from "@tanstack/react-router";
import { Clock, Layers } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceBadge } from "@/components/roadmap/source-badge";
import { levelLabel } from "@/components/roadmap/status";
import type { RoadmapSummary } from "@/lib/types";

export function RoadmapCard({ roadmap }: { roadmap: RoadmapSummary }) {
  const percent = roadmap.progress
    ? Math.round((roadmap.progress.done / Math.max(1, roadmap.progress.total)) * 100)
    : null;

  return (
    <Link
      to="/roadmaps/$slug"
      params={{ slug: roadmap.slug }}
      className="group flex h-full flex-col rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold leading-snug text-foreground group-hover:text-primary">
          {roadmap.title}
        </h3>
        <SourceBadge source={roadmap.source} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {roadmap.description}
      </p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>{levelLabel[roadmap.level]}</span>
        <span className="flex items-center gap-1">
          <Layers className="size-3.5" aria-hidden="true" />
          {roadmap.node_count} topics
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3.5" aria-hidden="true" />~{roadmap.estimated_hours} h
        </span>
      </div>
      {roadmap.progress && percent !== null && (
        <div className="mt-auto pt-4">
          <Progress
            value={percent}
            className="h-2 [&>div]:bg-warning"
            aria-label={`${percent}% complete`}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {roadmap.progress.done}/{roadmap.progress.total} done
          </p>
        </div>
      )}
    </Link>
  );
}

export function RoadmapCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-4/5" />
      <Skeleton className="mt-5 h-3 w-1/2" />
    </div>
  );
}
