import { afterEach, describe, expect, it, vi } from "vitest";

import { getHint, getSolution } from "@/lib/api";
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
