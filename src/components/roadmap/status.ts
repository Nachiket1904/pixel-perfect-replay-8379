import type { Level, NodeStatus } from "@/lib/types";

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
