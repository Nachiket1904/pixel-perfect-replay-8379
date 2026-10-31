import { afterEach, describe, expect, it, vi } from "vitest";

import { progressErrorMessage } from "@/components/roadmap/status";
import { getDashboard, updateNodeStatus } from "@/lib/api";
import { ApiError } from "@/lib/types";

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
