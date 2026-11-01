// @vitest-environment node
/**
 * Runs the real harness in real Pyodide (from node_modules), so a Pyodide upgrade that breaks
 * the runner fails CI instead of failing for learners.
 */
import { loadPyodide, type PyodideInterface } from "pyodide";
import { beforeAll, describe, expect, it } from "vitest";

import { HARNESS } from "@/lib/python/harness";
import type { TestCase, TestResult } from "@/lib/python/protocol";

let py: PyodideInterface;
let out: string[] = [];

beforeAll(async () => {
  py = await loadPyodide();
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => out.push(`ERR:${s}`) });
  py.setStdin({ error: true });
  await py.runPythonAsync(HARNESS, { filename: "<harness>" });
}, 60_000);

function run(code: string, tests: TestCase[] = []) {
  out = [];
  const fn = py.globals["get"]("_padhlo_run");
  const result = fn(code, py.toPy(tests));
  const js = result.toJs({ dict_converter: Object.fromEntries }) as {
    error: string | null;
    tests: TestResult[];
  };
  result.destroy();
  fn.destroy();
  return { ...js, error: js.error ?? null }; // same normalisation as the worker
}

describe("Python harness (Day 16)", () => {
  it("captures print output", () => {
    const r = run('print("hi")\nprint(1 + 1)');
    expect(r.error).toBeNull();
    expect(out).toEqual(["hi", "2"]);
  });

  it("shows tracebacks from the learner's code only", () => {
    const r = run("x = 1\ny = x / 0");
    expect(r.error).toContain("ZeroDivisionError");
    expect(r.error).toContain('File "<your code>", line 2');
    expect(r.error).not.toContain("harness");
  });

  it("reports syntax errors", () => {
    expect(run("def f(:\n  pass").error).toContain("SyntaxError");
  });

  it("runs tests in the learner's namespace", () => {
    const r = run("def double(n):\n    return n * 2", [
      { name: "doubles 2", code: "assert double(2) == 4" },
      { name: "doubles -1", code: 'assert double(-1) == -3, "double(-1) should be -2"' },
      { name: "has triple", code: "triple(1)" },
    ]);
    expect(r.tests).toEqual([
      { name: "doubles 2", passed: true, message: "" },
      { name: "doubles -1", passed: false, message: "double(-1) should be -2" },
      { name: "has triple", passed: false, message: "NameError: name 'triple' is not defined" },
    ]);
  });

  it("skips tests when the code itself fails", () => {
    const r = run("raise ValueError('nope')", [{ name: "t", code: "assert True" }]);
    expect(r.error).toContain("ValueError: nope");
    expect(r.tests).toEqual([]);
  });

  it("starts every run with a fresh namespace", () => {
    run("secret = 42");
    expect(run("print(secret)").error).toContain("NameError");
  });

  it("survives exit() and input()", () => {
    expect(run("import sys\nsys.exit(0)").error).toContain("SystemExit");
    expect(run("input('name? ')").error).toMatch(/OSError|EOFError/);
  });
});
