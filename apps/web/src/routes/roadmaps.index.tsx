import { Link, createFileRoute } from "@tanstack/react-router";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoadmapCard, RoadmapCardSkeleton } from "@/components/roadmap/roadmap-card";
import { pageMeta } from "@/lib/seo";
import { useRoadmaps, type RoadmapFilter } from "@/lib/queries";

export const Route = createFileRoute("/roadmaps/")({
  head: () =>
    pageMeta(
      "Roadmaps",
      "Official and personalised learning roadmaps for Python, machine learning, LLMs and more.",
    ),
  component: RoadmapsPage,
});

function RoadmapsPage() {
  const [filter, setFilter] = useState<RoadmapFilter>("all");
  const [query, setQuery] = useState("");
  const roadmaps = useRoadmaps(filter);

  const q = query.trim().toLowerCase();
  const visible = (roadmaps.data ?? []).filter((r) => !q || r.title.toLowerCase().includes(q));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Roadmaps
          </h1>
          <p className="mt-2 text-muted-foreground">
            Pick a path, or build one around your own goal.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <label htmlFor="roadmap-search" className="sr-only">
            Search roadmaps
          </label>
          <Input
            id="roadmap-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roadmaps"
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as RoadmapFilter)} className="mt-6">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="official">Official</TabsTrigger>
          <TabsTrigger value="mine">My roadmaps</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {roadmaps.isPending && [0, 1, 2].map((i) => <RoadmapCardSkeleton key={i} />)}

        {roadmaps.isError && (
          <div className="col-span-full rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">We couldn't load roadmaps.</p>
            <Button variant="outline" className="mt-3" onClick={() => void roadmaps.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {roadmaps.isSuccess && visible.length === 0 && (
          <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="font-medium text-foreground">
              {filter === "mine" && !q
                ? "You haven't built a roadmap yet"
                : "No roadmaps match your search"}
            </p>
            <Button asChild className="mt-4">
              <Link to="/build">Build my roadmap</Link>
            </Button>
          </div>
        )}

        {visible.map((r) => (
          <RoadmapCard key={r.id} roadmap={r} />
        ))}

        {roadmaps.isSuccess && visible.length > 0 && (
          <Link
            to="/build"
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-5 text-center text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <Plus className="size-6" aria-hidden="true" />
            <span className="font-medium">Build your own roadmap</span>
          </Link>
        )}
      </div>
    </div>
  );
}
