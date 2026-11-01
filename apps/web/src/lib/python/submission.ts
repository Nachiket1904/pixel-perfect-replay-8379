import type { ExercisePreview, SubmissionRequest } from "@/lib/types";

import type { RunOutcome } from "./protocol";

/** Turns a browser run into what the API stores. */
export function toSubmission(
  code: string,
  outcome: RunOutcome,
  exercise: ExercisePreview,
): SubmissionRequest {
  const results = outcome.tests.map((t) => ({ ...t, message: t.message.slice(0, 2000) }));
  const allRan = results.length === exercise.tests.length;
  const status = outcome.error
    ? "error"
    : allRan && results.every((t) => t.passed)
      ? "passed"
      : "failed";
  return {
    code,
    status,
    results: status === "error" ? [] : results,
    error: outcome.error?.slice(0, 5000) ?? null,
    runtime_ms: Math.min(outcome.runtimeMs, 120_000),
  };
}
