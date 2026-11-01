import { useCallback, useEffect, useRef, useState } from "react";

import type { RunOutcome, TestCase } from "@/lib/python/protocol";
import { PythonRunner, type RunnerState } from "@/lib/python/runner";

export interface OutputLine {
  stream: "stdout" | "stderr";
  text: string;
}

/** One Python runner per editor. Output streams in as the code prints. */
export function usePythonRunner() {
  const runnerRef = useRef<PythonRunner | null>(null);
  const [state, setState] = useState<RunnerState>("idle");
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const getRunner = () => {
    runnerRef.current ??= new PythonRunner();
    runnerRef.current.setEvents({
      onState: setState,
      onOutput: (stream, text) => setOutput((lines) => [...lines, { stream, text }]),
    });
    return runnerRef.current;
  };

  useEffect(() => () => runnerRef.current?.dispose(), []);

  const run = useCallback(async (code: string, tests: TestCase[] = []) => {
    const runner = getRunner();
    if (runner.busy) return null;
    setOutput([]);
    setOutcome(null);
    setLoadError(null);
    try {
      const result = await runner.run(code, tests);
      setOutcome(result);
      return result;
    } catch (error) {
      setLoadError(
        `Couldn't load Python in your browser. Check your connection and try again. (${
          error instanceof Error ? error.message : String(error)
        })`,
      );
      return null;
    }
  }, []);

  const stop = useCallback(() => runnerRef.current?.stop(), []);
  const clear = useCallback(() => {
    setOutput([]);
    setOutcome(null);
    setLoadError(null);
  }, []);

  return { state, output, outcome, loadError, run, stop, clear };
}
