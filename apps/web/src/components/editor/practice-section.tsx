import { Link } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, Code2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { toSubmission } from "@/lib/python/submission";
import { useMe, useSubmissions, useSubmitExercise } from "@/lib/queries";
import {
  ApiError,
  type ExercisePreview,
  type NodeDetail,
  type SubmissionRequest,
} from "@/lib/types";

import { CodeEditor } from "./code-editor";
import { OutputPanel } from "./output-panel";
import { useDraft } from "./use-draft";
import { usePythonRunner } from "./use-python-runner";

export function PracticeSection({ node }: { node: NodeDetail }) {
  return node.exercise && node.exercise.tests.length > 0 ? (
    <ExercisePractice node={node} exercise={node.exercise} />
  ) : (
    <Scratchpad node={node} />
  );
}

/** Free-form editor. Opens on click so readers don't download the editor on every topic. */
function Scratchpad({ node }: { node: NodeDetail }) {
  const [open, setOpen] = useState(node.exercise !== null);
  const starter =
    node.exercise?.starter_code ??
    `# Scratchpad for "${node.title}"\n# Try the examples from this topic here.\n`;
  const [code, setCode] = useDraft(`${node.roadmap_slug}/${node.id}`, starter);
  const runner = usePythonRunner();

  return (
    <section aria-labelledby="practice-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-heading" className="text-xl font-semibold text-foreground">
          {node.exercise ? `Practice: ${node.exercise.title}` : "Code scratchpad"}
        </h2>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Code2 className="mr-2 size-4" aria-hidden="true" /> Open scratchpad
          </Button>
        )}
      </div>
      {open && (
        <>
          <CodeEditor
            label={`Scratchpad for ${node.title}`}
            value={code}
            onChange={setCode}
            initialValue={starter}
            onRun={() => void runner.run(code)}
            running={runner.state !== "idle"}
            onStop={runner.stop}
          />
          <OutputPanel {...runner} />
          <p className="text-xs text-muted-foreground">
            Runs in your browser with Pyodide. Your code is saved in this browser.
          </p>
        </>
      )}
    </section>
  );
}

function ExercisePractice({ node, exercise }: { node: NodeDetail; exercise: ExercisePreview }) {
  const starter = exercise.starter_code;
  const [code, setCode] = useDraft(`${node.roadmap_slug}/${node.id}`, starter);
  const runner = usePythonRunner();
  const me = useMe();
  const loggedIn = Boolean(me.data);
  const submissions = useSubmissions(exercise.id, loggedIn);
  const submit = useSubmitExercise(exercise.id);
  const [checking, setChecking] = useState(false);

  // No local draft but a saved attempt on the server (e.g. another device): restore it once.
  const restored = useRef(false);
  useEffect(() => {
    const latest = submissions.data?.latest;
    if (restored.current || !latest) return;
    restored.current = true;
    if (code === starter && latest.code !== starter) setCode(latest.code);
  }, [submissions.data, code, starter, setCode]);

  const busy = runner.state !== "idle";

  async function check() {
    setChecking(true);
    const outcome = await runner.run(code, exercise.tests);
    setChecking(false);
    // Stopped runs and runner load failures aren't attempts.
    if (!outcome || outcome.status === "stopped" || !loggedIn) return;
    submit.mutate(toSubmission(code, outcome, exercise), {
      onError: (error) =>
        toast.error(
          error instanceof ApiError && error.code === "RATE_LIMITED"
            ? "Too many checks at once. Wait a minute before saving again."
            : "Your result is shown, but we couldn't save this attempt.",
        ),
    });
  }

  const summary = submissions.data;

  return (
    <section aria-labelledby="practice-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-heading" className="text-xl font-semibold text-foreground">
          Practice: {exercise.title}
        </h2>
        {summary?.passed_ever && (
          <span className="flex items-center gap-1.5 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Solved
          </span>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <Markdown>{exercise.prompt_md}</Markdown>
      </div>

      <CodeEditor
        label={`Code for ${exercise.title}`}
        value={code}
        onChange={setCode}
        initialValue={starter}
        onRun={() => void runner.run(code)}
        running={busy}
        onStop={runner.stop}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={() => void check()} disabled={busy}>
          <ClipboardCheck className="mr-2 size-4" aria-hidden="true" />
          {checking ? "Checking…" : "Check my code"}
        </Button>
        <p className="text-sm text-muted-foreground">
          {loggedIn ? (
            summary ? (
              `${summary.attempts} attempt${summary.attempts === 1 ? "" : "s"} saved`
            ) : null
          ) : (
            <>
              <Link
                to="/login"
                search={{ redirect: `/roadmaps/${node.roadmap_slug}/${node.id}` }}
                className="font-medium text-primary hover:underline"
              >
                Log in
              </Link>{" "}
              to save your attempts.
            </>
          )}
        </p>
      </div>

      <OutputPanel {...runner} />

      <details className="rounded-lg border border-border bg-card p-4 text-sm">
        <summary className="cursor-pointer font-medium text-foreground">
          See the {exercise.tests.length} checks
        </summary>
        <ul className="mt-3 space-y-3">
          {exercise.tests.map((t) => (
            <li key={t.name}>
              <p className="text-foreground">{t.name}</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">
                {t.code}
              </pre>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
