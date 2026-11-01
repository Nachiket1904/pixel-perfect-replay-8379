import { Link } from "@tanstack/react-router";
import { Eye, Lightbulb, Lock } from "lucide-react";
import { useState } from "react";

import { CodeBlock } from "@/components/common/code-block";
import { Button } from "@/components/ui/button";
import { useHint, useSolution } from "@/lib/queries";
import { ApiError, type ExercisePreview, type SubmissionsSummary } from "@/lib/types";

interface Props {
  exercise: ExercisePreview;
  summary: SubmissionsSummary | undefined;
  loggedIn: boolean;
  /** Where to come back to after logging in. */
  redirect: string;
}

/** Day 18: hints one at a time, and the reference solution once the server unlocks it. */
export function ExerciseHelp({ exercise, summary, loggedIn, redirect }: Props) {
  return (
    <div className="space-y-3">
      {exercise.hints_count > 0 && <Hints exercise={exercise} />}
      <SolutionReveal
        exerciseId={exercise.id}
        summary={summary}
        loggedIn={loggedIn}
        redirect={redirect}
      />
    </div>
  );
}

function Hints({ exercise }: { exercise: ExercisePreview }) {
  const [revealed, setRevealed] = useState(0);
  const total = exercise.hints_count;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Lightbulb className="size-4 text-warning" aria-hidden="true" />
          Stuck? Hints
        </p>
        {revealed < total && (
          <Button variant="outline" size="sm" onClick={() => setRevealed((n) => n + 1)}>
            Show hint {revealed + 1} of {total}
          </Button>
        )}
      </div>
      {revealed > 0 && (
        <ol className="mt-3 space-y-2" aria-live="polite">
          {Array.from({ length: revealed }, (_, i) => (
            <HintItem key={i} exerciseId={exercise.id} index={i + 1} />
          ))}
        </ol>
      )}
    </div>
  );
}

function HintItem({ exerciseId, index }: { exerciseId: string; index: number }) {
  const hint = useHint(exerciseId, index, true);
  return (
    <li className="flex gap-2 text-sm leading-6 text-muted-foreground">
      <span className="shrink-0 font-medium text-foreground">{index}.</span>
      {/* Plain text on purpose: hints are content, never rendered as HTML. */}
      <span>
        {hint.isPending && "Loading…"}
        {hint.isError && "Couldn't load this hint. Try again in a moment."}
        {hint.data?.text}
      </span>
    </li>
  );
}

function SolutionReveal({
  exerciseId,
  summary,
  loggedIn,
  redirect,
}: {
  exerciseId: string;
  summary: SubmissionsSummary | undefined;
  loggedIn: boolean;
  redirect: string;
}) {
  const [show, setShow] = useState(false);
  const unlocked = Boolean(summary?.solution_unlocked);
  const solution = useSolution(exerciseId, loggedIn && unlocked && show);
  const needed = summary?.attempts_to_unlock ?? 3;
  const attempts = Math.min(summary?.attempts ?? 0, needed);

  if (!loggedIn) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden="true" />
        <span>
          <Link
            to="/login"
            search={{ redirect }}
            className="font-medium text-primary hover:underline"
          >
            Log in
          </Link>{" "}
          to unlock the solution after {needed} attempts.
        </span>
      </p>
    );
  }

  if (!unlocked) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Lock className="size-4" aria-hidden="true" />
        The solution unlocks after {needed} attempts ({attempts}/{needed}). Try the hints first.
      </p>
    );
  }

  if (!show) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setShow(true)} className="px-0">
        <Eye className="mr-2 size-4" aria-hidden="true" /> Show the solution
      </Button>
    );
  }

  if (solution.isPending) return <p className="text-sm text-muted-foreground">Loading solution…</p>;
  if (solution.isError) {
    const locked = solution.error instanceof ApiError && solution.error.code === "FORBIDDEN";
    return (
      <p className="text-sm text-destructive">
        {locked ? solution.error.message : "Couldn't load the solution. Try again in a moment."}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        One way to solve it. Compare it with yours rather than pasting it in.
      </p>
      <CodeBlock code={solution.data.solution_code} label="solution.py" />
    </div>
  );
}
