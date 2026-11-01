import type { FromWorker, RunOutcome, TestCase, ToWorker } from "./protocol";

export type RunnerState = "idle" | "loading" | "running";

export interface RunnerEvents {
  onState?: (state: RunnerState) => void;
  onOutput?: (stream: "stdout" | "stderr", text: string) => void;
}

/** Wall-clock limit for the learner's code, after packages have loaded. */
export const DEFAULT_TIMEOUT_MS = 10_000;

type WorkerFactory = () => Worker;

const defaultFactory: WorkerFactory = () =>
  new Worker(new URL("../../workers/pyodide.worker.ts", import.meta.url), {
    type: "module",
    name: "pyodide",
  });

/**
 * Owns one Pyodide worker. Loads lazily on first run, and replaces the worker after a stop or
 * timeout, because terminating is the only reliable way to interrupt a `while True:` loop.
 */
export class PythonRunner {
  private worker: Worker | null = null;
  private ready: Promise<void> | null = null;
  private nextId = 1;
  private finish: ((outcome: RunOutcome) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private state: RunnerState = "idle";

  constructor(
    private events: RunnerEvents = {},
    private timeoutMs = DEFAULT_TIMEOUT_MS,
    private factory: WorkerFactory = defaultFactory,
  ) {}

  setEvents(events: RunnerEvents) {
    this.events = events;
  }

  get busy() {
    return this.state !== "idle";
  }

  private setState(state: RunnerState) {
    this.state = state;
    this.events.onState?.(state);
  }

  private start(): Promise<void> {
    if (this.ready) return this.ready;
    const worker = this.factory();
    this.worker = worker;
    this.ready = new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<FromWorker>) => {
        const msg = event.data;
        if (msg.type === "ready") resolve();
        else if (msg.type === "load-error") reject(new Error(msg.message));
        else this.handle(msg);
      };
      worker.onerror = (event) => {
        event.preventDefault();
        reject(new Error(event.message || "The Python runner failed to start."));
      };
    });
    // A failed load shouldn't poison later attempts (e.g. the network came back).
    this.ready.catch(() => this.reset());
    return this.ready;
  }

  private reset() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
  }

  private handle(msg: FromWorker) {
    if (msg.type === "started") {
      this.setState("running");
      this.timer = setTimeout(() => this.abort("timeout"), this.timeoutMs);
    } else if (msg.type === "output") {
      this.events.onOutput?.(msg.stream, msg.text);
    } else if (msg.type === "done") {
      this.settle({
        status: msg.error ? "error" : "ok",
        error: msg.error,
        tests: msg.tests,
        runtimeMs: msg.runtimeMs,
        truncated: msg.truncated,
      });
    }
  }

  private settle(outcome: RunOutcome) {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const finish = this.finish;
    this.finish = null;
    this.setState("idle");
    finish?.(outcome);
  }

  private abort(status: "timeout" | "stopped") {
    if (!this.finish) return;
    this.reset(); // the next run boots a fresh worker
    this.settle({
      status,
      error:
        status === "timeout"
          ? `Stopped after ${this.timeoutMs / 1000} seconds. Is there an infinite loop?`
          : "Stopped.",
      tests: [],
      runtimeMs: this.timeoutMs,
      truncated: false,
    });
  }

  /** Runs code (and optional tests). Rejects only if Pyodide itself can't load. */
  async run(code: string, tests: TestCase[] = []): Promise<RunOutcome> {
    if (this.finish) throw new Error("Already running.");
    this.setState("loading");
    try {
      await this.start();
    } catch (error) {
      this.setState("idle");
      throw error;
    }
    return new Promise<RunOutcome>((resolve) => {
      this.finish = resolve;
      const msg: ToWorker = { type: "run", id: this.nextId++, code, tests };
      this.worker?.postMessage(msg);
    });
  }

  stop() {
    if (this.finish) this.abort("stopped");
  }

  dispose() {
    this.stop();
    this.reset();
  }
}
