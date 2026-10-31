import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/types";

interface ErrorStateProps {
  error: unknown;
  /** What was being loaded, e.g. "topic" or "paper". */
  thing: string;
  onRetry: () => void;
  backTo: "/roadmaps" | "/papers" | "/";
  backLabel: string;
}

/** Full-page error: "not found" gets no retry button, everything else does. */
export function ErrorState({ error, thing, onRetry, backTo, backLabel }: ErrorStateProps) {
  const notFound = error instanceof ApiError && error.code === "NOT_FOUND";
  return (
    <div className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-foreground">
        {notFound
          ? `${thing[0]?.toUpperCase()}${thing.slice(1)} not found`
          : `Couldn't load this ${thing}`}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {notFound
          ? "It may have been removed, or the link is wrong."
          : "Please check your connection and try again."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {!notFound && <Button onClick={onRetry}>Try again</Button>}
        <Button variant="outline" asChild>
          <Link to={backTo}>{backLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
