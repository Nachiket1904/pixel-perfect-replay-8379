// The only place that calls fetch(). Every request goes to the same origin (/api/v1/...),
// which the web server proxies to FastAPI, so auth cookies are first-party and SameSite=Lax works.
import { ApiError, type ApiErrorCode } from "@/lib/types";

const API_BASE = "/api/v1";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions {
  method?: Method;
  body?: unknown;
  signal?: AbortSignal;
}

// One shared refresh at a time: if five queries get a 401 together, only one refresh call is made.
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(`${API_BASE}/auth/refresh`, { method: "POST", credentials: "same-origin" })
    .then((res) => res.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const init: RequestInit = {
    method: options.method ?? "GET",
    headers,
    credentials: "same-origin",
    signal: options.signal ?? null,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  try {
    return await fetch(`${API_BASE}${path}`, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(
      "NETWORK_ERROR",
      "Can't reach PadhLo right now. Check your connection and try again.",
    );
  }
}

function toApiError(status: number, payload: unknown): ApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown; details?: unknown } })
    ?.error;
  const fallbackCode: ApiErrorCode = status >= 500 ? "SERVER_ERROR" : "BAD_REQUEST";
  const code = typeof error?.code === "string" ? (error.code as ApiErrorCode) : fallbackCode;
  const message =
    typeof error?.message === "string" ? error.message : "Something went wrong. Please try again.";
  return new ApiError(code, message, error?.details);
}

/**
 * Call the API and return the parsed JSON body, or throw an ApiError with the server's code.
 * On a 401 it refreshes the session once and retries (access tokens live 15 minutes).
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response = await send(path, options);
  if (response.status === 401 && !path.startsWith("/auth/")) {
    // Retry even if the refresh failed: the failed refresh clears dead cookies, so public
    // endpoints then answer as a logged-out user instead of failing.
    await refreshSession();
    response = await send(path, options);
  }
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw toApiError(response.status, payload);
  return payload as T;
}
