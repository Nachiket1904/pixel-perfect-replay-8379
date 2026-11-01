/// <reference lib="webworker" />
/**
 * Runs learner Python with Pyodide, off the main thread so a busy loop can't freeze the page.
 * Stop/timeout = the page terminates this worker and starts a fresh one.
 */
import type { PyodideInterface } from "pyodide";

import { HARNESS } from "@/lib/python/harness";
import {
  MAX_OUTPUT_CHARS,
  PYODIDE_INDEX_URL,
  type FromWorker,
  type ToWorker,
} from "@/lib/python/protocol";

declare const self: DedicatedWorkerGlobalScope;

const post = (msg: FromWorker) => self.postMessage(msg);

// Hardening: learner code can reach JS through Pyodide's `js` module. This worker is same-origin,
// so block network APIs except fetches to the Pyodide CDN (needed to load packages like NumPy).
// Pasted code then can't call our API with the learner's cookies.
const realFetch = self.fetch.bind(self);
self.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.startsWith(PYODIDE_INDEX_URL)) {
    return Promise.reject(new TypeError("Network access is disabled in the code runner."));
  }
  return realFetch(input, { ...init, credentials: "omit" });
};
for (const name of ["XMLHttpRequest", "WebSocket", "EventSource"] as const) {
  Reflect.deleteProperty(self, name);
}

let currentId = 0;
let outputChars = 0;
let truncated = false;

function emit(stream: "stdout" | "stderr", text: string) {
  if (truncated) return;
  outputChars += text.length + 1;
  if (outputChars > MAX_OUTPUT_CHARS) {
    truncated = true;
    return;
  }
  post({ type: "output", id: currentId, stream, text });
}

async function boot(): Promise<PyodideInterface> {
  const { loadPyodide } = (await import(
    /* @vite-ignore */ `${PYODIDE_INDEX_URL}pyodide.mjs`
  )) as typeof import("pyodide");
  const pyodide = await loadPyodide({ indexURL: PYODIDE_INDEX_URL });
  pyodide.setStdout({ batched: (s) => emit("stdout", s) });
  pyodide.setStderr({ batched: (s) => emit("stderr", s) });
  pyodide.setStdin({ error: true }); // input() raises instead of hanging
  await pyodide.runPythonAsync(HARNESS, { filename: "<harness>" });
  return pyodide;
}

const ready = boot().then(
  (pyodide) => {
    post({ type: "ready" });
    return pyodide;
  },
  (error: unknown) => {
    post({ type: "load-error", message: error instanceof Error ? error.message : String(error) });
    throw error;
  },
);

self.onmessage = async (event: MessageEvent<ToWorker>) => {
  const msg = event.data;
  if (msg.type !== "run") return;
  const pyodide = await ready;
  currentId = msg.id;
  outputChars = 0;
  truncated = false;

  // NumPy etc. are downloaded on first import; that time doesn't count toward the timeout.
  try {
    await pyodide.loadPackagesFromImports(msg.code);
  } catch {
    // Unknown imports fail with a normal ModuleNotFoundError when the code runs.
  }
  post({ type: "started", id: msg.id });

  const start = performance.now();
  const run = pyodide.globals["get"]("_padhlo_run");
  const tests = pyodide.toPy(msg.tests);
  try {
    const result = run(msg.code, tests);
    const out = result.toJs({ dict_converter: Object.fromEntries }) as {
      error: string | null;
      tests: { name: string; passed: boolean; message: string }[];
    };
    result.destroy();
    post({
      type: "done",
      id: msg.id,
      error: out.error ?? null, // Python None arrives as undefined
      tests: out.tests,
      runtimeMs: Math.round(performance.now() - start),
      truncated,
    });
  } catch (error) {
    post({
      type: "done",
      id: msg.id,
      error: error instanceof Error ? error.message : String(error),
      tests: [],
      runtimeMs: Math.round(performance.now() - start),
      truncated,
    });
  } finally {
    tests.destroy();
    run.destroy();
  }
};
