// The data layer. Components -> hooks (queries.ts) -> these functions.
// Real endpoints are defined in this file; anything not built yet still comes from the mock
// layer through the re-export below. A local export with the same name wins over `export *`.
import { request } from "@/lib/http";
import * as mock from "@/lib/mock-api";
import {
  ApiError,
  type Dashboard,
  type GenerateRoadmapRequest,
  type GenerationQuota,
  type LoginRequest,
  type NodeStatus,
  type NodeDetail,
  type RegisterRequest,
  type Roadmap,
  type RoadmapSummary,
  type Hint,
  type Solution,
  type StatusResult,
  type SubmissionRequest,
  type SubmissionsSummary,
  type User,
} from "@/lib/types";

export * from "@/lib/mock-api";

// ---------- Auth (Day 7) ----------

/** The logged-in user, or null when logged out. Never throws for "not logged in". */
export async function getMe(): Promise<User | null> {
  try {
    return await request<User>("/users/me");
  } catch (error) {
    if (error instanceof ApiError && error.code === "NOT_AUTHENTICATED") return null;
    throw error;
  }
}

export function login(body: LoginRequest): Promise<User> {
  return request<User>("/auth/login", { method: "POST", body });
}

export function register(body: RegisterRequest): Promise<User> {
  return request<User>("/auth/register", { method: "POST", body });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

// ---------- Roadmaps (Day 9) ----------

export function listRoadmaps(
  filter: "all" | "official" | "mine" = "all",
): Promise<RoadmapSummary[]> {
  return request<RoadmapSummary[]>(`/roadmaps?filter=${encodeURIComponent(filter)}`);
}

export function getRoadmap(slug: string): Promise<Roadmap> {
  return request<Roadmap>(`/roadmaps/${encodeURIComponent(slug)}`);
}

// ---------- Topic page (Day 10) ----------

export function getNode(slug: string, nodeId: string): Promise<NodeDetail> {
  return request<NodeDetail>(
    `/roadmaps/${encodeURIComponent(slug)}/nodes/${encodeURIComponent(nodeId)}`,
  );
}

// ---------- Progress (Day 11) ----------

/** Saves a topic's status for the logged-in user. Throws NOT_AUTHENTICATED when logged out. */
export function updateNodeStatus(
  roadmap: { id: string; slug: string },
  nodeId: string,
  status: NodeStatus,
): Promise<StatusResult> {
  return request<StatusResult>(
    `/roadmaps/${encodeURIComponent(roadmap.slug)}/nodes/${encodeURIComponent(nodeId)}/progress`,
    { method: "PUT", body: { status } },
  );
}

// ---------- Dashboard (Day 12) ----------

type DashboardApi = Omit<Dashboard, "featured_papers">;

export async function getDashboard(): Promise<Dashboard> {
  // Papers become real on Day 22; until then the featured list comes from the mock.
  const [real, papers] = await Promise.all([
    request<DashboardApi>("/users/me/dashboard"),
    mock.getDashboard().then((d) => d.featured_papers),
  ]);
  return { ...real, featured_papers: papers };
}

// ---------- Exercises (Day 17) ----------

/** Saves a browser run. The server stores it as unverified (the browser can't be trusted). */
export function submitExercise(
  exerciseId: string,
  body: SubmissionRequest,
): Promise<SubmissionsSummary> {
  return request<SubmissionsSummary>(`/exercises/${encodeURIComponent(exerciseId)}/submissions`, {
    method: "POST",
    body,
  });
}

export function getSubmissions(exerciseId: string): Promise<SubmissionsSummary> {
  return request<SubmissionsSummary>(
    `/exercises/${encodeURIComponent(exerciseId)}/submissions/latest`,
  );
}

// ---------- Hints and solutions (Day 18) ----------

/** One hint (1-based). Hints are public; the UI just reveals them one at a time. */
export function getHint(exerciseId: string, index: number): Promise<Hint> {
  return request<Hint>(`/exercises/${encodeURIComponent(exerciseId)}/hints/${index}`);
}

/** The reference solution. The server answers FORBIDDEN until enough attempts are saved. */
export function getSolution(exerciseId: string): Promise<Solution> {
  return request<Solution>(`/exercises/${encodeURIComponent(exerciseId)}/solution`);
}

// ---------- AI roadmap generator (Days 19-20) ----------

/** Builds a private roadmap from the learner's goal. Login required; limits are enforced server-side. */
export function generateRoadmap(body: GenerateRoadmapRequest): Promise<Roadmap> {
  return request<Roadmap>("/generator/roadmaps", { method: "POST", body });
}

export function getGenerationQuota(): Promise<GenerationQuota> {
  return request<GenerationQuota>("/generator/quota");
}
