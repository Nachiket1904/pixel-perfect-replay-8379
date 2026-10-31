import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Clock, ExternalLink, Lightbulb, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/components/common/markdown";
import { ErrorState } from "@/components/common/states";
import { formatAuthors } from "@/components/papers/paper-card";
import { levelLabel } from "@/components/roadmap/status";
import { usePaper } from "@/lib/queries";
import type { ImplementationStatus, Paper } from "@/lib/types";

export const Route = createFileRoute("/papers/$id")({
  head: () => ({ meta: [{ title: "Paper | PadhLo With Us" }] }),
  component: PaperPage,
});

function PaperPage() {
  const { id } = Route.useParams();
  const paper = usePaper(id);

  if (paper.isPending) return <PaperSkeleton />;
  if (paper.isError) {
    return (
      <ErrorState
        error={paper.error}
        thing="paper"
        onRetry={() => void paper.refetch()}
        backTo="/papers"
        backLabel="All papers"
      />
    );
  }
  return <PaperView paper={paper.data} />;
}

const statusBadge: Record<ImplementationStatus, string> = {
  draft: "Draft",
  reviewed: "Reviewed",
  published: "Published",
};

function PaperView({ paper }: { paper: Paper }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/papers" className="hover:text-foreground">
          Papers
        </Link>
      </nav>

      <header className="mt-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{paper.published_at}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono">arXiv:{paper.external_id}</span>
          {paper.categories.map((c) => (
            <Badge key={c} variant="secondary" className="font-mono text-[10px]">
              {c}
            </Badge>
          ))}
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {paper.title}
        </h1>
        <p className="mt-2 text-muted-foreground" title={paper.authors.join(", ")}>
          {formatAuthors(paper.authors, 5)}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" asChild>
            <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer nofollow">
              Read the PDF on arXiv <ExternalLink className="ml-2 size-4" aria-hidden="true" />
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href={paper.abs_url} target="_blank" rel="noopener noreferrer nofollow">
              arXiv page
            </a>
          </Button>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <main className="min-w-0 space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-foreground">In plain language</h2>
              <Badge variant="outline" className="gap-1 border-warning text-accent-foreground">
                <Sparkles className="size-3" aria-hidden="true" /> AI-assisted summary
              </Badge>
            </div>
            <div className="mt-3">
              {paper.summary_md ? (
                <Markdown>{paper.summary_md}</Markdown>
              ) : (
                <p className="text-muted-foreground">{paper.short_description}</p>
              )}
            </div>
          </section>

          {paper.key_ideas.length > 0 && (
            <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Lightbulb className="size-5 text-warning" aria-hidden="true" /> Key ideas
              </h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-foreground">
                {paper.key_ideas.map((idea) => (
                  <li key={idea}>{idea}</li>
                ))}
              </ul>
            </section>
          )}
        </main>

        <aside>
          <h2 className="font-semibold text-foreground">Implement it</h2>
          {paper.implementations.length === 0 ? (
            <div className="mt-3 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              No guide yet for this paper. We add hand-checked guides regularly.
            </div>
          ) : (
            <ul className="mt-3 space-y-3">
              {paper.implementations.map((impl) => (
                <li key={impl.id} className="rounded-lg border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium leading-snug text-foreground">{impl.title}</h3>
                    <Badge variant={impl.status === "draft" ? "outline" : "secondary"}>
                      {statusBadge[impl.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    <span>{levelLabel[impl.difficulty]}</span>
                    <span>{impl.step_count} steps</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" aria-hidden="true" />~{impl.estimated_minutes} min
                    </span>
                  </p>
                  <Button
                    asChild
                    className="mt-3 w-full bg-warning text-foreground hover:bg-warning/90"
                  >
                    <Link to="/implementations/$id" params={{ id: impl.id }}>
                      Start guide <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function PaperSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-56" />
      <Skeleton className="mt-4 h-9 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <Skeleton className="mt-8 h-64" />
    </div>
  );
}
