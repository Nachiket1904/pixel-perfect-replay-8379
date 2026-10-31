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

// ---------- Node detail ----------

export type ResourceKind = "docs" | "video" | "article" | "course" | "search";

export interface Resource {
  title: string;
  url: string;
  kind: ResourceKind;
  is_free: boolean;
}

export interface NodeRef {
  id: string;
  title: string;
  status: NodeStatus;
}

export interface ExercisePreview {
  id: string;
  title: string;
  language: "python";
  starter_code: string;
}

export interface NodeDetail extends RoadmapNode {
  roadmap_id: string;
  roadmap_slug: string;
  roadmap_title: string;
  roadmap_source: RoadmapSource;
  content_md: string;
  resources: Resource[];
  exercise: ExercisePreview | null;
  linked_paper: PaperSummary | null;
  prerequisites: NodeRef[];
  unlocks: NodeRef[];
}

// ---------- Dashboard ----------

export interface ActiveRoadmap {
  roadmap: RoadmapSummary;
  next_node: NodeRef | null;
}

export interface Dashboard {
  active: ActiveRoadmap[];
  featured_papers: PaperSummary[];
}

// ---------- Papers ----------

export interface PaperSummary {
  id: string;
  source: "arxiv";
  external_id: string;
  title: string;
  authors: string[];
  published_at: string;
  categories: string[];
  short_description: string;
  has_implementation: boolean;
}

export type ImplementationStatus = "draft" | "reviewed" | "published";

export interface ImplementationSummary {
  id: string;
  title: string;
  status: ImplementationStatus;
  difficulty: Level;
  language: "python";
  step_count: number;
  estimated_minutes: number;
}

export interface Paper extends PaperSummary {
  pdf_url: string;
  abs_url: string;
  summary_md: string | null;
  key_ideas: string[];
  implementations: ImplementationSummary[];
}

/**
 * One step of an implementation guide. There is deliberately no solution_code here:
 * reference solutions stay on the server and are released by the API (Day 18 rule:
 * after 3 attempts), so they can't be read from the page source.
 */
export interface ImplementationStep {
  position: number;
  title: string;
  explanation_md: string;
  starter_code: string;
  checks: string[];
  hints: string[];
}

export interface Implementation extends ImplementationSummary {
  paper_id: string;
  paper_title: string;
  steps: ImplementationStep[];
}

export interface PaperSearchParams {
  q?: string;
  category?: string;
}
