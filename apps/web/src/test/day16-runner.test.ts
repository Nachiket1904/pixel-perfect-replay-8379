import { afterEach, describe, expect, it, vi } from "vitest";

import type { FromWorker, ToWorker } from "@/lib/python/protocol";
import { PythonRunner } from "@/lib/python/runner";

/** Stands in for the Pyodide worker; tests script what it "sends back". */
class FakeWorker {
  onmessage: ((e: MessageEvent<FromWorker>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  sent: ToWorker[] = [];
  terminated = false;
  postMessage(msg: ToWorker) {
    this.sent.push(msg);
  }
  terminate() {
    this.terminated = true;
  }
  emit(msg: FromWorker) {
    this.onmessage?.({ data: msg } as MessageEvent<FromWorker>);
  }
}

function setup(timeoutMs = 1000) {
  const workers: FakeWorker[] = [];
  const states: string[] = [];
  const output: string[] = [];
  const runner = new PythonRunner(
    { onState: (s) => states.push(s), onOutput: (_s, t) => output.push(t) },
    timeoutMs,
    () => {
      const w = new FakeWorker();
      workers.push(w);
      return w as unknown as Worker;
    },
  );
  return { runner, workers, states, output };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("PythonRunner (Day 16)", () => {
  afterEach(() => vi.useRealTimers());

  it("boots lazily, streams output and resolves on done", async () => {
    const { runner, workers, states, output } = setup();
    expect(workers).toHaveLength(0);
    const p = runner.run("print(1)");
    const w = workers[0]!;
    w.emit({ type: "ready" });
    await tick();
    expect(w.sent[0]).toMatchObject({ type: "run", code: "print(1)" });
    w.emit({ type: "started", id: 1 });
    w.emit({ type: "output", id: 1, stream: "stdout", text: "1" });
    w.emit({ type: "done", id: 1, error: null, tests: [], runtimeMs: 3, truncated: false });
    await expect(p).resolves.toMatchObject({ status: "ok", runtimeMs: 3 });
    expect(output).toEqual(["1"]);
    expect(states).toEqual(["loading", "running", "idle"]);
  });

  it("times out an infinite loop and replaces the worker", async () => {
    vi.useFakeTimers();
    const { runner, workers } = setup(500);
    const p = runner.run("while True: pass");
    workers[0]!.emit({ type: "ready" });
    await vi.advanceTimersByTimeAsync(0);
    workers[0]!.emit({ type: "started", id: 1 });
    await vi.advanceTimersByTimeAsync(600);
    await expect(p).resolves.toMatchObject({ status: "timeout" });
    expect(workers[0]!.terminated).toBe(true);

    void runner.run("print(2)");
    expect(workers).toHaveLength(2); // fresh worker for the next run
  });

  it("stop() ends the run", async () => {
    const { runner, workers } = setup();
    const p = runner.run("x");
    workers[0]!.emit({ type: "ready" });
    await tick();
    workers[0]!.emit({ type: "started", id: 1 });
    runner.stop();
    await expect(p).resolves.toMatchObject({ status: "stopped" });
    expect(runner.busy).toBe(false);
  });

  it("rejects when Pyodide can't load, then retries with a new worker", async () => {
    const { runner, workers } = setup();
    const p = runner.run("x");
    workers[0]!.emit({ type: "load-error", message: "offline" });
    await expect(p).rejects.toThrow("offline");
    void runner.run("x");
    expect(workers).toHaveLength(2);
  });

  it("does not time out while packages are still downloading", async () => {
    vi.useFakeTimers();
    const { runner, workers } = setup(500);
    const p = runner.run("import numpy");
    workers[0]!.emit({ type: "ready" });
    await vi.advanceTimersByTimeAsync(5000); // no "started" yet: NumPy still loading
    workers[0]!.emit({ type: "started", id: 1 });
    workers[0]!.emit({
      type: "done",
      id: 1,
      error: null,
      tests: [],
      runtimeMs: 9,
      truncated: false,
    });
    await expect(p).resolves.toMatchObject({ status: "ok" });
  });
});
