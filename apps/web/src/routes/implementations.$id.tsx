import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Lightbulb, Play } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeBlock } from "@/components/common/code-block";
import { Markdown } from "@/components/common/markdown";
import { ErrorState } from "@/components/common/states";
import { useImplementation } from "@/lib/queries";
import type { Implementation } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PlayerSearch {
  step?: number;
}

export const Route = createFileRoute("/implementations/$id")({
  validateSearch: (search: Record<string, unknown>): PlayerSearch => {
    const step = Number(search["step"]);
    return Number.isInteger(step) && step >= 1 && step <= 50 ? { step } : {};
  },
  head: () => ({ meta: [{ title: "Implementation guide | PadhLo With Us" }] }),
  component: PlayerPage,
});

function PlayerPage() {
  const { id } = Route.useParams();
  const impl = useImplementation(id);

  if (impl.isPending) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="mt-8 h-96" />
      </div>
    );
  }
  if (impl.isError) {
    return (
      <ErrorState
        error={impl.error}
        thing="guide"
        onRetry={() => void impl.refetch()}
        backTo="/papers"
        backLabel="All papers"
      />
    );
  }
  return <Player impl={impl.data} />;
}

function Player({ impl }: { impl: Implementation }) {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const total = impl.steps.length;
  const current = Math.min(Math.max(search.step ?? 1, 1), total);
  const step = impl.steps[current - 1];
  // Revealed hints per step. Local only for now; saved per user once progress hits the API (Day 24).
  const [hintsShown, setHintsShown] = useState<Record<number, number>>({});

  if (!step) return null;
  const shown = hintsShown[current] ?? 0;
  const goTo = (n: number) => void navigate({ search: { step: n } });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/papers" className="hover:text-foreground">
          Papers
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link to="/papers/$id" params={{ id: impl.paper_id }} className="hover:text-foreground">
          {impl.paper_title}
        </Link>
      </nav>
      <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        {impl.title}
      </h1>
      <div className="mt-4 max-w-md">
        <Progress
          value={(current / total) * 100}
          className="h-2 [&>div]:bg-warning"
          aria-label={`Step ${current} of ${total}`}
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Step {current} of {total}
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <ol
          className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0"
          aria-label="Steps"
        >
          {impl.steps.map((s) => {
            const active = s.position === current;
            const past = s.position < current;
            return (
              <li key={s.position} className="shrink-0">
                <button
                  type="button"
                  onClick={() => goTo(s.position)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "border-primary bg-primary/5 font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {past ? (
                    <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <Circle
                      className={cn("size-4 shrink-0", active && "text-primary")}
                      aria-hidden="true"
                    />
                  )}
                  <span className="whitespace-nowrap lg:whitespace-normal">
                    {s.position}. {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <main className="min-w-0 space-y-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">
              {step.position}. {step.title}
            </h2>
            <div className="mt-3">
              <Markdown>{step.explanation_md}</Markdown>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-foreground">Your code</h3>
              <Button disabled className="bg-warning text-foreground hover:bg-warning/90">
                <Play className="mr-2 size-4" aria-hidden="true" /> Run tests (coming soon)
              </Button>
            </div>
            <CodeBlock code={step.starter_code} />
          </section>

          <section className="rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground">The tests will check</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground">
              {step.checks.map((c) => (
                <li key={c} className="flex items-start gap-2">
                  <Circle
                    className="mt-1 size-3 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {c}
                </li>
              ))}
            </ul>
          </section>

          {step.hints.length > 0 && (
            <section className="rounded-lg border border-warning/40 bg-accent/50 p-5">
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Lightbulb className="size-4 text-warning" aria-hidden="true" /> Hints
              </h3>
              {shown > 0 && (
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-foreground">
                  {step.hints.slice(0, shown).map((h) => (
                    <li key={h}>{h}</li>
                  ))}
                </ol>
              )}
              {shown < step.hints.length && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => setHintsShown((prev) => ({ ...prev, [current]: shown + 1 }))}
                >
                  {shown === 0 ? "Show a hint" : "Show another hint"}
                </Button>
              )}
            </section>
          )}

          <div className="flex justify-between gap-3 border-t border-border pt-6">
            <Button variant="outline" disabled={current === 1} onClick={() => goTo(current - 1)}>
              <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Previous
            </Button>
            {current < total ? (
              <Button onClick={() => goTo(current + 1)}>
                Next step <ArrowRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link to="/papers/$id" params={{ id: impl.paper_id }}>
                  Back to paper
                </Link>
              </Button>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
