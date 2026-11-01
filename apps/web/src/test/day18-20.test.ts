import { afterEach, describe, expect, it, vi } from "vitest";

import { generatorErrorMessage } from "@/components/roadmap/generator-errors";
import { generateRoadmap, getGenerationQuota, getHint, getRoadmap, getSolution } from "@/lib/api";
import { ApiError } from "@/lib/types";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("hints and solutions (Day 18)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches one hint by its 1-based index", async () => {
    const fetchMock = vi.fn(async () => json(200, { index: 2, total: 3, text: "Use zip()." }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getHint("ex-1", 2)).resolves.toEqual({ index: 2, total: 3, text: "Use zip()." });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe("/api/v1/exercises/ex-1/hints/2");
  });

  it("surfaces the server's lock as FORBIDDEN", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(403, {
          error: {
            code: "FORBIDDEN",
            message: "Make 3 attempts first, then the solution unlocks.",
            details: { attempts: 1, attempts_to_unlock: 3 },
          },
        }),
      ),
    );
    const error = await getSolution("ex-1").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("FORBIDDEN");
  });
});

// ---------- Days 19-20: AI roadmap generator ----------

describe("generator API (Days 19-20)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the goal to the real endpoint", async () => {
    const fetchMock = vi.fn(async () => json(201, { slug: "ml-path-abc123" }));
    vi.stubGlobal("fetch", fetchMock);
    await generateRoadmap({ goal: "Become an ML engineer", level: "beginner", hours_per_week: 6 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/generator/roadmaps");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      goal: "Become an ML engineer",
      level: "beginner",
      hours_per_week: 6,
    });
  });

  it("reads the quota from the server", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(200, { remaining: 2, limit: 3, resets_at: "2026-11-02T00:00:00+05:30" }),
      ),
    );
    await expect(getGenerationQuota()).resolves.toMatchObject({ remaining: 2, limit: 3 });
  });

  it("no longer falls back to mock roadmaps on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(404, { error: { code: "NOT_FOUND", message: "nope" } })),
    );
    await expect(getRoadmap("llm-engineer-a1b2")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("explains each generator error and offers official roadmaps when useful", () => {
    const quota = generatorErrorMessage(new ApiError("RATE_LIMITED", "x", { limit: 3 }));
    expect(quota.body).toMatch(/today's 3 roadmaps/);
    expect(quota.showOfficial).toBe(true);
    const attempts = generatorErrorMessage(new ApiError("RATE_LIMITED", "x", { retry_after: 60 }));
    expect(attempts.title).toMatch(/Too many tries/);
    expect(generatorErrorMessage(new ApiError("GENERATOR_UNAVAILABLE", "x")).showOfficial).toBe(
      true,
    );
    expect(generatorErrorMessage(new ApiError("GENERATION_FAILED", "x")).body).toMatch(/reword/);
    expect(generatorErrorMessage(new ApiError("NON_TECH_GOAL", "x")).showOfficial).toBe(false);
    expect(generatorErrorMessage(new Error("boom")).title).toMatch(/went wrong/);
  });
});
