// Repo visualizer API calls and types. Re-export from api.ts if you want one entry point:
//   export * from "./repos-api";

export type RepoSyncStatus = "pending" | "syncing" | "ok" | "failed";

export type RepoSummary = {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  default_branch: string | null;
  commit_sha: string | null;
  stars: number;
  sync_status: RepoSyncStatus;
  sync_error: string | null;
  last_synced_at: string | null;
};

export type RepoSymbol = {
  id: string; // "path::name"
  name: string; // "func", "Class" or "Class.method"
  kind: "function" | "class" | "method" | "component";
  line: number;
  summary: string | null;
  calls: string[]; // symbol ids
};

export type RepoFileInfo = {
  path: string;
  lang: "python" | "javascript" | "typescript";
  lines: number;
  summary: string | null;
  is_entry: boolean;
  parse_error: boolean;
  imports: string[];
  imported_by: string[];
  externals: string[];
  symbols: RepoSymbol[];
  module_calls: string[];
};

export type RepoFolderInfo = {
  path: string;
  files: number;
  code_files: number;
  role: string | null;
  summary: string | null;
};

export type RepoAnalysis = {
  version: number;
  stats: {
    files: number;
    code_files: number;
    lines: number;
    languages: Record<string, number>;
    truncated: boolean;
  };
  readme: string | null;
  entry_points: string[];
  core_files: string[];
  reading_order: string[];
  libraries: { name: string; files: number }[];
  folders: RepoFolderInfo[];
  folder_edges: { from: string; to: string; count: number }[];
  tree: string[];
  files: RepoFileInfo[];
};

export type RepoStructure = { repo: RepoSummary; analysis: RepoAnalysis };
export type RepoFileContent = { path: string; content: string; truncated: boolean };

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Log in to use the repo visualizer.");
    if (res.status === 502 || res.status === 503) throw new Error("The server is waking up. Try again in a moment.");
    const detail = body?.error?.message ?? (typeof body?.detail === "string" ? body.detail : null);
    throw new Error(detail ?? `Request failed (${res.status})`);
  }
  return body as T;
}

const repoPath = (id: string) => `/api/v1/repos/${encodeURIComponent(id)}`;

export const analyzeRepo = (url: string) =>
  getJson<RepoSummary>("/api/v1/repos/analyze", { method: "POST", body: JSON.stringify({ url }) });

export const getRepo = (id: string) => getJson<RepoSummary>(repoPath(id));

export const getRepoStructure = (id: string) => getJson<RepoStructure>(`${repoPath(id)}/structure`);

export const getRepoFile = (id: string, path: string) =>
  getJson<RepoFileContent>(`${repoPath(id)}/file?path=${encodeURIComponent(path)}`);
