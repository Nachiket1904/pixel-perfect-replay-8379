/** Messages between the page and the Pyodide worker. */

export interface TestCase {
  name: string;
  /** Python run after the learner's code, in the same namespace (usually asserts). */
  code: string;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface RunOutcome {
  /** "error" = the learner's code raised before tests could run (or timed out / was stopped). */
  status: "ok" | "error" | "timeout" | "stopped";
  error: string | null;
  tests: TestResult[];
  runtimeMs: number;
  /** Output was cut off at MAX_OUTPUT_CHARS. */
  truncated: boolean;
}

export type ToWorker = { type: "run"; id: number; code: string; tests: TestCase[] };

export type FromWorker =
  | { type: "ready" }
  | { type: "load-error"; message: string }
  | { type: "started"; id: number } // packages loaded, user code starts now (timer starts)
  | { type: "output"; id: number; stream: "stdout" | "stderr"; text: string }
  | {
      type: "done";
      id: number;
      error: string | null;
      tests: TestResult[];
      runtimeMs: number;
      truncated: boolean;
    };

export const PYODIDE_VERSION = "314.0.7";
export const PYODIDE_INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
export const MAX_OUTPUT_CHARS = 100_000;
