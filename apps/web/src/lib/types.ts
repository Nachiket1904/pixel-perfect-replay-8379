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
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "NON_TECH_GOAL"
  | "RATE_LIMITED"
  | "SERVER_ERROR"
  | "NOT_AUTHENTICATED"
  | "FORBIDDEN"
  | "EMAIL_TAKEN"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "NETWORK_ERROR";

/** One entry of `details` on a VALIDATION_ERROR response. */
export interface FieldError {
  field: string;
  message: string;
}

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

export interface ExerciseTest {
  name: string;
  /** Python run after the learner's code (usually asserts). Shown to the learner. */
  code: string;
}

/** Mirrors ExerciseOut in apps/api/app/modules/exercises/schemas.py. Never has the solution. */
export interface ExercisePreview {
  id: string;
  title: string;
  language: "python";
  prompt_md: string;
  starter_code: string;
  tests: ExerciseTest[];
  hints_count: number;
}

export type SubmissionStatus = "passed" | "failed" | "error";

export interface SubmissionTestResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface Submission {
  id: string;
  status: SubmissionStatus;
  code: string;
  results: SubmissionTestResult[];
  error: string | null;
  runtime_ms: number;
  /** Always false in v1: browser runs can't be trusted (server re-runs arrive with the sandbox). */
  verified: boolean;
  created_at: string;
}

export interface SubmissionsSummary {
  latest: Submission | null;
  attempts: number;
  passed_ever: boolean;
  /** Day 18: the server unlocks the reference solution after N attempts or once solved. */
  solution_unlocked: boolean;
  attempts_to_unlock: number;
}

/** Mirrors HintOut in apps/api/app/modules/exercises/schemas.py. `index` is 1-based. */
export interface Hint {
  index: number;
  total: number;
  text: string;
}

export interface Solution {
  solution_code: string;
}

export interface SubmissionRequest {
  code: string;
  status: SubmissionStatus;
  results: SubmissionTestResult[];
  error: string | null;
  runtime_ms: number;
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
  streak_days: number;
  /** When the learner last made progress, relative to today (IST). */
  activity: "today" | "yesterday" | "lapsed" | "never";
}

/** Mirrors StatusOut in apps/api/app/modules/progress/schemas.py. */
export interface StatusResult {
  node_id: string;
  status: NodeStatus;
  done: number;
  total: number;
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

// ---------- Auth ----------

export type Role = "learner" | "instructor" | "admin";

/** Mirrors UserOut in apps/api/app/modules/users/schemas.py. */
export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: Role;
  xp: number;
  streak_days: number;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  name: string;
}
