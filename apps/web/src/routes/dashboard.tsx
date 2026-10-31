import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Map, Sparkles } from "lucide-react";

import { RequireAuth } from "@/components/auth/require-auth";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PaperCard, PaperCardSkeleton } from "@/components/papers/paper-card";
import { SourceBadge } from "@/components/roadmap/source-badge";
import { pageMeta } from "@/lib/seo";
import { useDashboard } from "@/lib/queries";
import type { ActiveRoadmap } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({
  head: () => pageMeta("Dashboard", "Continue your roadmaps and pick your next topic."),
  component: ProtectedDashboard,
});

function ProtectedDashboard() {
  return (
    <RequireAuth>
      <DashboardPage />
    </RequireAuth>
  );
}

function DashboardPage() {
  const dashboard = useDashboard();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Your learning
      </h1>
      <p className="mt-2 text-muted-foreground">Pick up where you left off.</p>

      <section className="mt-8" aria-labelledby="continue-heading">
        <h2 id="continue-heading" className="text-xl font-semibold text-foreground">
          Continue learning
        </h2>

        {dashboard.isPending && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44" />
            <Skeleton className="h-44" />
          </div>
        )}

        {dashboard.isError && (
          <div className="mt-4 rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">We couldn't load your dashboard.</p>
            <Button variant="outline" className="mt-3" onClick={() => void dashboard.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {dashboard.data && dashboard.data.active.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="font-medium text-foreground">You haven't started a roadmap yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Build one around your goal, or pick an official path.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button asChild className="bg-warning text-foreground hover:bg-warning/90">
                <Link to="/build">
                  <Sparkles className="mr-2 size-4" aria-hidden="true" /> Build my roadmap
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/roadmaps">
                  <Map className="mr-2 size-4" aria-hidden="true" /> Browse roadmaps
                </Link>
              </Button>
            </div>
          </div>
        )}

        {dashboard.data && dashboard.data.active.length > 0 && (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {dashboard.data.active.map((item) => (
              <ContinueCard key={item.roadmap.id} item={item} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12" aria-labelledby="papers-heading">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 id="papers-heading" className="text-xl font-semibold text-foreground">
            Implement a famous paper
          </h2>
          <Link to="/papers" className="text-sm font-medium text-primary hover:underline">
            Browse papers
          </Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {dashboard.isPending && <PaperCardSkeleton />}
          {dashboard.data?.featured_papers.map((p) => (
            <PaperCard key={p.id} paper={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ContinueCard({ item }: { item: ActiveRoadmap }) {
  const { roadmap, next_node } = item;
  const done = roadmap.progress?.done ?? 0;
  const total = roadmap.progress?.total ?? roadmap.node_count;
  const percent = Math.round((done / Math.max(1, total)) * 100);

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <Link
          to="/roadmaps/$slug"
          params={{ slug: roadmap.slug }}
          className="font-semibold text-foreground hover:text-primary"
        >
          {roadmap.title}
        </Link>
        <SourceBadge source={roadmap.source} />
      </div>
      <Progress
        value={percent}
        className="mt-4 h-2 [&>div]:bg-warning"
        aria-label={`${percent}% complete`}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">
        {done}/{total} topics done
      </p>
      <div className="mt-auto pt-4">
        {next_node ? (
          <Button asChild className="w-full justify-between">
            <Link
              to="/roadmaps/$slug/$nodeId"
              params={{ slug: roadmap.slug, nodeId: next_node.id }}
            >
              <span className="truncate">Next: {next_node.title}</span>
              <ArrowRight className="ml-2 size-4 shrink-0" aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          <p className="text-sm font-medium text-success">Roadmap complete. Nice work!</p>
        )}
      </div>
    </div>
  );
}
