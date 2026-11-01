import { afterEach, describe, expect, it, vi } from "vitest";

import { progressErrorMessage } from "@/components/roadmap/status";
import { getDashboard, submitExercise, updateNodeStatus } from "@/lib/api";
import { toSubmission } from "@/lib/python/submission";
import { ApiError, type ExercisePreview } from "@/lib/types";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("progress API (Day 11)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("PUTs the status to the slug/key endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      json(200, { node_id: "py-numpy", status: "done", done: 1, total: 12 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      updateNodeStatus({ id: "r1", slug: "python-for-ml" }, "py-numpy", "done"),
    ).resolves.toMatchObject({ done: 1 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/roadmaps/python-for-ml/nodes/py-numpy/progress");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ status: "done" });
  });

  it("explains logged-out and rate-limited failures", () => {
    expect(progressErrorMessage(new ApiError("NOT_AUTHENTICATED", "x"))).toMatch(/Log in/);
    expect(progressErrorMessage(new ApiError("RATE_LIMITED", "x"))).toMatch(/Too many/);
    expect(progressErrorMessage(new Error("boom"))).toMatch(/try again/);
  });
});

describe("dashboard API (Day 12)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uses the real dashboard and keeps mock papers until Day 22", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(200, { active: [], streak_days: 3, activity: "yesterday" })),
    );
    const d = await getDashboard();
    expect(d.streak_days).toBe(3);
    expect(d.activity).toBe("yesterday");
    expect(d.featured_papers.length).toBeGreaterThan(0);
  });
});

// ---------- Day 17 ----------

const ex: ExercisePreview = {
  id: "e1",
  title: "t",
  language: "python",
  prompt_md: "",
  starter_code: "",
  tests: [
    { name: "a", code: "assert 1" },
    { name: "b", code: "assert 1" },
  ],
  hints_count: 0,
};
const base = { status: "ok" as const, error: null, runtimeMs: 5, truncated: false };

describe("exercise submissions (Day 17)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps runs to passed / failed / error", () => {
    const pass = [
      { name: "a", passed: true, message: "" },
      { name: "b", passed: true, message: "" },
    ];
    expect(toSubmission("c", { ...base, tests: pass }, ex).status).toBe("passed");
    expect(
      toSubmission("c", { ...base, tests: [pass[0]!, { ...pass[1]!, passed: false }] }, ex).status,
    ).toBe("failed");
    expect(toSubmission("c", { ...base, tests: pass.slice(0, 1) }, ex).status).toBe("failed");
    const err = toSubmission("c", { ...base, status: "error", error: "Boom", tests: [] }, ex);
    expect(err).toMatchObject({ status: "error", results: [], error: "Boom" });
  });

  it("POSTs to the submissions endpoint", async () => {
    const fetchMock = vi.fn(async () =>
      json(201, { latest: null, attempts: 1, passed_ever: false }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await submitExercise("abc", {
      code: "x",
      status: "error",
      results: [],
      error: "e",
      runtime_ms: 1,
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/v1/exercises/abc/submissions");
    expect(init.method).toBe("POST");
  });
});
