import { toast } from "sonner";

import { ApiError, type Level, type NodeStatus } from "@/lib/types";

export const statusLabel: Record<NodeStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

export const levelLabel: Record<Level, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Tailwind classes for a node card in each status. */
export const statusNodeClass: Record<NodeStatus, string> = {
  not_started: "border-border bg-card text-foreground",
  in_progress: "border-warning bg-card text-foreground ring-2 ring-warning/30",
  done: "border-success bg-success text-white",
};

export const statusDotClass: Record<NodeStatus, string> = {
  not_started: "bg-muted-foreground/40",
  in_progress: "bg-warning",
  done: "bg-success",
};

/** What to tell the learner when saving a status fails. */
export function progressErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "NOT_AUTHENTICATED") return "Log in to save your progress.";
    if (error.code === "RATE_LIMITED")
      return "Too many changes at once. Wait a moment and try again.";
  }
  return "Couldn't save your progress. Please try again.";
}

/** Error toast for a failed status change; logged-out learners get a "Log in" button. */
export function showProgressError(error: unknown): void {
  const loggedOut = error instanceof ApiError && error.code === "NOT_AUTHENTICATED";
  toast.error(progressErrorMessage(error), {
    action: loggedOut
      ? {
          label: "Log in",
          onClick: () => {
            const here = window.location.pathname + window.location.search;
            window.location.assign(`/login?redirect=${encodeURIComponent(here)}`);
          },
        }
      : undefined,
  });
}
