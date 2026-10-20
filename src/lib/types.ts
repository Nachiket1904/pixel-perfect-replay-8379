export type RoadmapSource = "official" | "ai";
export type Level = "beginner" | "intermediate" | "advanced";
export type NodeStatus = "not_started" | "in_progress" | "done";

export interface Progress {
  done: number;
  total: number;
}

export interface RoadmapSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  source: RoadmapSource;
  level: Level;
  node_count: number;
  estimated_hours: number;
  progress: Progress | null;
}

export interface RoadmapNode {
  id: string;
  title: string;
  summary: string;
  node_type: "topic" | "milestone";
  position: { x: number; y: number };
  status: NodeStatus;
  has_exercise: boolean;
  linked_paper_id: string | null;
}

export interface RoadmapEdge {
  id: string;
  from_node_id: string;
  to_node_id: string;
  kind: "prerequisite" | "optional";
}

export interface Roadmap extends RoadmapSummary {
  goal_prompt: string | null;
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  created_at: string;
}

export interface GenerateRoadmapRequest {
  goal: string;
  level: Level;
  hours_per_week: number;
}

export interface GenerationQuota {
  remaining: number;
  limit: number;
  resets_at: string;
}

export type ApiErrorCode =
  "NOT_FOUND" | "VALIDATION_ERROR" | "NON_TECH_GOAL" | "RATE_LIMITED" | "SERVER_ERROR";

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
