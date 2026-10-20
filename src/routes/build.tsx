import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Check, Info, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RoadmapCard, RoadmapCardSkeleton } from "@/components/roadmap/roadmap-card";
import { pageMeta } from "@/lib/seo";
import { useGenerateRoadmap, useGenerationQuota, useRoadmaps } from "@/lib/queries";
import { ApiError, type Level } from "@/lib/types";

const GOAL_MIN = 10;
const GOAL_MAX = 300;

interface BuildSearch {
  goal?: string;
}

export const Route = createFileRoute("/build")({
  validateSearch: (search: Record<string, unknown>): BuildSearch =>
    typeof search["goal"] === "string" && search["goal"].trim()
      ? { goal: search["goal"].slice(0, GOAL_MAX) }
      : {},
  head: () =>
    pageMeta(
      "Build my roadmap",
      "Describe your tech learning goal and get a personalised roadmap with free resources.",
    ),
  component: BuildPage,
});

const levels: { value: Level; label: string; hint: string }[] = [
  { value: "beginner", label: "Beginner", hint: "New to this topic, or to coding" },
  { value: "intermediate", label: "Intermediate", hint: "Know the basics, built small things" },
  { value: "advanced", label: "Advanced", hint: "Work with it, want to go deeper" },
];

const hourOptions = [3, 6, 10, 15];

const loadingSteps = ["Understanding your goal", "Ordering topics", "Adding free resources"];

function errorMessage(error: unknown): { title: string; body: string; showOfficial: boolean } {
  const code = error instanceof ApiError ? error.code : "SERVER_ERROR";
  switch (code) {
    case "NON_TECH_GOAL":
      return {
        title: "That goal is outside what we cover",
        body: "PadhLo builds tech learning roadmaps. Try a programming, data or AI goal.",
        showOfficial: false,
      };
    case "RATE_LIMITED":
      return {
        title: "Daily limit reached",
        body: "You've used today's 3 roadmaps. Try again tomorrow, or start an official roadmap.",
        showOfficial: true,
      };
    case "VALIDATION_ERROR":
      return {
        title: "Please check your goal",
        body: error instanceof Error ? error.message : "Something in the form needs fixing.",
        showOfficial: false,
      };
    default:
      return {
        title: "Something went wrong",
        body: "We couldn't build your roadmap this time. Please try again in a moment.",
        showOfficial: false,
      };
  }
}

function BuildPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const quota = useGenerationQuota();
  const official = useRoadmaps("official");
  const generate = useGenerateRoadmap();

  const [goal, setGoal] = useState(search.goal ?? "");
  const [level, setLevel] = useState<Level>("beginner");
  const [hours, setHours] = useState("6");
  const [touched, setTouched] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Keep the field in sync if the user arrives again with a new ?goal=.
  useEffect(() => {
    if (search.goal) setGoal(search.goal);
  }, [search.goal]);

  // Tick through the loading steps while the request runs.
  useEffect(() => {
    if (!generate.isPending) {
      setStepIndex(0);
      return;
    }
    const timer = setInterval(
      () => setStepIndex((i) => Math.min(i + 1, loadingSteps.length - 1)),
      900,
    );
    return () => clearInterval(timer);
  }, [generate.isPending]);

  const trimmed = goal.trim();
  // Client-side checks are for UX only. The API validates everything again.
  const goalError =
    trimmed.length < GOAL_MIN
      ? `Write at least ${GOAL_MIN} characters so we understand your goal.`
      : null;
  const noQuota = quota.data?.remaining === 0;
  const canSubmit = !goalError && !generate.isPending && !noQuota;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    generate.mutate(
      { goal: trimmed, level, hours_per_week: Number(hours) },
      {
        onSuccess: (roadmap) =>
          void navigate({ to: "/roadmaps/$slug", params: { slug: roadmap.slug } }),
      },
    );
  };

  const failure = generate.isError ? errorMessage(generate.error) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Build my roadmap
        </h1>
        <p className="mt-3 text-muted-foreground">
          Tell us where you want to go. We'll lay out the topics in order, with free resources for
          each one.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form
          onSubmit={onSubmit}
          className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6"
          noValidate
        >
          <fieldset disabled={generate.isPending} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="goal">What do you want to learn?</Label>
              <Textarea
                id="goal"
                value={goal}
                onChange={(e) => setGoal(e.target.value.slice(0, GOAL_MAX))}
                onBlur={() => setTouched(true)}
                rows={4}
                maxLength={GOAL_MAX}
                placeholder="e.g. I want to become an LLM engineer. I know basic Python."
                aria-invalid={touched && goalError ? true : undefined}
                aria-describedby="goal-help"
              />
              <div id="goal-help" className="flex justify-between gap-3 text-xs">
                <span className="text-destructive">{touched && goalError}</span>
                <span className="shrink-0 text-muted-foreground">
                  {goal.length}/{GOAL_MAX}
                </span>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="level">Your level</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as Level)}>
                  <SelectTrigger id="level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {levels.map((l) => (
                      <SelectItem key={l.value} value={l.value}>
                        <span className="font-medium">{l.label}</span>
                        <span className="ml-2 text-muted-foreground">{l.hint}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Hours per week</Label>
                <Select value={hours} onValueChange={setHours}>
                  <SelectTrigger id="hours">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hourOptions.map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h} hours{h === 15 ? "+" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </fieldset>

          {failure && (
            <Alert variant="destructive" className="mt-5">
              <AlertCircle className="size-4" />
              <AlertTitle>{failure.title}</AlertTitle>
              <AlertDescription>
                {failure.body}
                {failure.showOfficial && (
                  <Link to="/roadmaps" className="ml-1 font-medium underline">
                    Browse official roadmaps
                  </Link>
                )}
              </AlertDescription>
            </Alert>
          )}

          {generate.isPending && (
            <ol
              className="mt-5 space-y-2 rounded-md border border-border bg-secondary/50 p-4"
              aria-live="polite"
            >
              {loadingSteps.map((label, i) => (
                <li key={label} className="flex items-center gap-2 text-sm">
                  {i < stepIndex ? (
                    <Check className="size-4 text-success" aria-hidden="true" />
                  ) : i === stepIndex ? (
                    <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                  ) : (
                    <span className="size-4 rounded-full border border-border" aria-hidden="true" />
                  )}
                  <span className={i <= stepIndex ? "text-foreground" : "text-muted-foreground"}>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {quota.isPending && "Checking your daily limit…"}
              {quota.data && `${quota.data.remaining} of ${quota.data.limit} roadmaps left today`}
            </p>
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit && (touched || generate.isPending || noQuota)}
              className="bg-warning text-foreground hover:bg-warning/90"
            >
              {generate.isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" aria-hidden="true" />
                  Generate my roadmap
                </>
              )}
            </Button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="flex gap-3 rounded-lg border border-border bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p>
              AI-generated roadmaps can be imperfect. Resources are free and come from official docs
              and curated lists.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-foreground">
              Not sure? Start with an official roadmap
            </h2>
            <div className="mt-3 grid gap-3">
              {official.isPending && [0, 1].map((i) => <RoadmapCardSkeleton key={i} />)}
              {official.data?.slice(0, 2).map((r) => (
                <RoadmapCard key={r.id} roadmap={r} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
