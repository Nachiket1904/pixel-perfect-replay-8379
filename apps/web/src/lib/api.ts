// The data layer. Components -> hooks (queries.ts) -> these functions.
// Real endpoints are defined in this file; anything not built yet still comes from the mock
// layer through the re-export below. A local export with the same name wins over `export *`.
import { request } from "@/lib/http";
import { ApiError, type LoginRequest, type RegisterRequest, type User } from "@/lib/types";

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
