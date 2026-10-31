import { afterEach, describe, expect, it, vi } from "vitest";

import { getMe } from "@/lib/api";
import { request } from "@/lib/http";
import { safeRedirect } from "@/lib/redirect";

describe("safeRedirect", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/roadmaps/python-for-ml?tab=list", "/roadmaps/python-for-ml?tab=list"],
    ["https://evil.com", "/dashboard"],
    ["//evil.com", "/dashboard"],
    ["/\\evil.com", "/dashboard"],
    ["/login", "/dashboard"],
    [undefined, "/dashboard"],
  ])("%s -> %s", (input, expected) => {
    expect(safeRedirect(input)).toBe(expected);
  });
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("http client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps the API error shape to ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(409, { error: { code: "EMAIL_TAKEN", message: "Taken" } })),
    );
    await expect(request("/auth/register", { method: "POST", body: {} })).rejects.toMatchObject({
      code: "EMAIL_TAKEN",
      message: "Taken",
    });
  });

  it("refreshes once on 401 and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: "NOT_AUTHENTICATED", message: "x" } }))
      .mockResolvedValueOnce(json(200, {})) // POST /auth/refresh
      .mockResolvedValueOnce(json(200, { id: "u1", name: "Asha" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getMe()).resolves.toMatchObject({ id: "u1" });
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "/api/v1/users/me",
      "/api/v1/auth/refresh",
      "/api/v1/users/me",
    ]);
  });

  it("returns null from getMe when logged out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(401, { error: { code: "NOT_AUTHENTICATED", message: "x" } })),
    );
    await expect(getMe()).resolves.toBeNull();
  });
});
