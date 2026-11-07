// Repo visualizer API calls. Re-export from api.ts if you want one entry point:
//   export * from "./repos-api";

export type RepoSyncStatus = "pending" | "syncing" | "ok" | "failed";

export type RepoSummary = {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string | null;
  stars: number;
  sync_status: RepoSyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
};

export type RepoBranch = { name: string; head_sha: string; is_default: boolean };
export type RepoTag = { name: string; sha: string; released_at: string | null };
export type RepoCommit = {
  sha: string;
  message: string;
  author_name: string;
  author_login: string | null;
  committed_at: string;
  parent_shas: string[];
};
export type RepoGraph = {
  repo: RepoSummary;
  branches: RepoBranch[];
  tags: RepoTag[];
  commits: RepoCommit[];
};

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = body?.error?.message ?? (typeof body?.detail === "string" ? body.detail : null);
    if (res.status === 401) throw new Error("Log in to analyze a repository.");
    throw new Error(detail ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export const analyzeRepo = (url: string) =>
  getJson<RepoSummary>("/api/v1/repos/analyze", { method: "POST", body: JSON.stringify({ url }) });

export const getRepo = (id: string) => getJson<RepoSummary>(`/api/v1/repos/${encodeURIComponent(id)}`);

export const getRepoGraph = (id: string) =>
  getJson<RepoGraph>(`/api/v1/repos/${encodeURIComponent(id)}/graph`);
