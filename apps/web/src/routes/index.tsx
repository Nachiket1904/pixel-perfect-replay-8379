import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Code2, FileText, GitBranch, ListChecks, Map, Target } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RoadmapCard, RoadmapCardSkeleton } from "@/components/roadmap/roadmap-card";
import { useRoadmaps } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PadhLo With Us — Tell us what you want to learn. Get your roadmap." },
      {
        name: "description",
        content:
          "Free, personalised tech learning roadmaps for students and early-career developers, with in-browser coding, research papers and real GitHub projects.",
      },
      { property: "og:title", content: "PadhLo With Us — Get your learning roadmap" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

const examples = [
  "Become an ML engineer",
  "Learn backend with FastAPI",
  "Understand LLMs from scratch",
];

const steps = [
  {
    icon: Target,
    title: "Describe your goal",
    text: "Tell us what you want to learn, your level, and how many hours you have each week.",
  },
  {
    icon: Map,
    title: "Get a roadmap",
    text: "See the topics in the right order, with clear prerequisites, like a map of the journey.",
  },
  {
    icon: ListChecks,
    title: "Learn and practise",
    text: "Each topic has free resources, and many have exercises you can run in your browser.",
  },
];

const features = [
  {
    icon: Code2,
    title: "Code in your browser",
    text: "Write and run Python right next to the topic. Nothing to install.",
    to: "/roadmaps" as const,
  },
  {
    icon: FileText,
    title: "Paper to Code Lab",
    text: "Read famous research papers in plain language, then implement them step by step.",
    to: "/papers" as const,
  },
  {
    icon: GitBranch,
    title: "GitHub Repo Visualizer",
    text: "See how real projects grow: branches, versions and commit history as a graph.",
    to: "/repos" as const,
  },
];

function HomePage() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState("");
  const official = useRoadmaps("official");

  const goToBuild = (value: string) => {
    const trimmed = value.trim().slice(0, 300);
    void navigate({ to: "/build", search: trimmed ? { goal: trimmed } : {} });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    goToBuild(goal);
  };

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-border bg-secondary/60">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
            Tell us what you want to learn.
            <span className="block text-primary">Get your roadmap.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
            Free resources, practice code in your browser, and learn from real research papers and
            real GitHub projects.
          </p>

          <form
            onSubmit={onSubmit}
            className="mx-auto mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="hero-goal" className="sr-only">
              What do you want to learn?
            </label>
            <Input
              id="hero-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              maxLength={300}
              placeholder="e.g. I want to become an LLM engineer"
              className="h-12 bg-card text-base"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 bg-warning text-foreground hover:bg-warning/90"
            >
              Build my roadmap <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
          </form>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => goToBuild(example)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-foreground">How it works</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li key={title} className="rounded-lg border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-3 font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Official roadmaps */}
      <section className="border-y border-border bg-secondary/40">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Start with an official roadmap</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hand-written and reviewed. A good place to begin.
              </p>
            </div>
            <Link to="/roadmaps" className="text-sm font-medium text-primary hover:underline">
              See all roadmaps
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {official.isPending && [0, 1].map((i) => <RoadmapCardSkeleton key={i} />)}
            {official.isError && (
              <p className="text-sm text-muted-foreground">
                Couldn't load roadmaps.{" "}
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => void official.refetch()}
                >
                  Try again
                </button>
              </p>
            )}
            {official.data?.map((r) => (
              <RoadmapCard key={r.id} roadmap={r} />
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-foreground">More than a roadmap</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text, to }) => (
            <Link
              key={title}
              to={to}
              className="group rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
            >
              <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold text-foreground group-hover:text-primary">
                {title}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="bg-primary">
        <div className="mx-auto flex max-w-7xl flex-col items-start gap-4 px-4 py-12 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div>
            <h2 className="text-2xl font-bold text-primary-foreground">
              Know what you want to learn?
            </h2>
            <p className="mt-1 text-primary-foreground/80">
              It takes about a minute to get your roadmap.
            </p>
          </div>
          <Button asChild size="lg" className="bg-warning text-foreground hover:bg-warning/90">
            <Link to="/build">
              Build my roadmap <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
