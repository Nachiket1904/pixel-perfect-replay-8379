import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import type { RunOutcome } from "@/lib/python/protocol";
import type { RunnerState } from "@/lib/python/runner";
import { cn } from "@/lib/utils";

import type { OutputLine } from "./use-python-runner";

interface OutputPanelProps {
  state: RunnerState;
  output: OutputLine[];
  outcome: RunOutcome | null;
  loadError: string | null;
}

export function OutputPanel({ state, output, outcome, loadError }: OutputPanelProps) {
  const idle = state === "idle";
  const empty = output.length === 0 && !outcome && !loadError;

  return (
    <div className="space-y-3">
      <div
        className="overflow-hidden rounded-lg border border-border bg-muted/40"
        role="region"
        aria-label="Output"
      >
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-medium text-foreground">Output</span>
          {!idle && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              {state === "loading" ? "Loading Python…" : "Running…"}
            </span>
          )}
          {idle && outcome && (
            <span className="text-xs text-muted-foreground">{outcome.runtimeMs} ms</span>
          )}
        </div>
        <pre
          className="max-h-72 overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-sm leading-relaxed"
          aria-live="polite"
        >
          {empty && (
            <span className="text-muted-foreground">
              {idle
                ? "Run your code to see the output here."
                : "The first run downloads Python (about 10 MB), so it takes a few seconds."}
            </span>
          )}
          {idle && outcome && output.length === 0 && !outcome.error && (
            <span className="text-muted-foreground">(no output)</span>
          )}
          {output.map((line, i) => (
            <span key={i} className={cn("block", line.stream === "stderr" && "text-destructive")}>
              {line.text}
            </span>
          ))}
          {outcome?.truncated && (
            <span className="block text-muted-foreground">… output cut off (too long)</span>
          )}
          {outcome?.error && <span className="mt-1 block text-destructive">{outcome.error}</span>}
          {loadError && <span className="block text-destructive">{loadError}</span>}
        </pre>
      </div>

      {outcome && outcome.tests.length > 0 && <TestResults outcome={outcome} />}
    </div>
  );
}

function TestResults({ outcome }: { outcome: RunOutcome }) {
  const passed = outcome.tests.filter((t) => t.passed).length;
  const all = passed === outcome.tests.length;
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        all ? "border-success/40 bg-success/5" : "border-border bg-card",
      )}
      role="status"
    >
      <p className="font-semibold text-foreground">
        {all
          ? "All checks passed. Nice work!"
          : `${passed} of ${outcome.tests.length} checks passed`}
      </p>
      <ul className="mt-3 space-y-2">
        {outcome.tests.map((t) => (
          <li key={t.name} className="flex gap-2 text-sm">
            {t.passed ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-label="Passed" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Failed" />
            )}
            <span>
              <span className="text-foreground">{t.name}</span>
              {!t.passed && t.message && (
                <span className="block font-mono text-xs text-muted-foreground">{t.message}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
