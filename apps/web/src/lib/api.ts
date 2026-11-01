// The data layer. Components -> hooks (queries.ts) -> these functions.
// Real endpoints are defined in this file; anything not built yet still comes from the mock
// layer through the re-export below. A local export with the same name wins over `export *`.
import { request } from "@/lib/http";
import * as mock from "@/lib/mock-api";
import {
  ApiError,
  type Dashboard,
  type LoginRequest,
  type NodeStatus,
  type NodeDetail,
  type RegisterRequest,
  type Roadmap,
  type RoadmapSummary,
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

export async function getRoadmap(slug: string): Promise<Roadmap> {
  try {
    return await request<Roadmap>(`/roadmaps/${encodeURIComponent(slug)}`);
  } catch (error) {
    // TODO(Day 19): remove. "Build my roadmap" is still mocked, so its roadmaps only exist
    // in the mock store. The mock throws NOT_FOUND itself for anything else.
    if (error instanceof ApiError && error.code === "NOT_FOUND") return mock.getRoadmap(slug);
    throw error;
  }
}

// ---------- Topic page (Day 10) ----------

export async function getNode(slug: string, nodeId: string): Promise<NodeDetail> {
  try {
    return await request<NodeDetail>(
      `/roadmaps/${encodeURIComponent(slug)}/nodes/${encodeURIComponent(nodeId)}`,
    );
  } catch (error) {
    // TODO(Day 19): remove with the getRoadmap fallback above (mock "Build my roadmap").
    if (error instanceof ApiError && error.code === "NOT_FOUND") return mock.getNode(slug, nodeId);
    throw error;
  }
}

// ---------- Progress (Day 11) ----------

/** Saves a topic's status for the logged-in user. Throws NOT_AUTHENTICATED when logged out. */
export async function updateNodeStatus(
  roadmap: { id: string; slug: string },
  nodeId: string,
  status: NodeStatus,
): Promise<StatusResult | void> {
  try {
    return await request<StatusResult>(
      `/roadmaps/${encodeURIComponent(roadmap.slug)}/nodes/${encodeURIComponent(nodeId)}/progress`,
      { method: "PUT", body: { status } },
    );
  } catch (error) {
    // TODO(Day 19): remove with the other mock fallbacks ("Build my roadmap" is still mocked).
    if (error instanceof ApiError && error.code === "NOT_FOUND")
      return mock.updateNodeStatus(roadmap.id, nodeId, status);
    throw error;
  }
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
