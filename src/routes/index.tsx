import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, BookOpen, GitFork, Library, Map, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PadhLo With Us — Learn tech, one step at a time" },
      {
        name: "description",
        content: "Explore structured learning roadmaps and practical resources for your next step in tech.",
      },
      { property: "og:title", content: "PadhLo With Us — Learn tech, one step at a time" },
      {
        property: "og:description",
        content: "Explore structured learning roadmaps and practical resources for your next step in tech.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HomePage,
});

const destinations = [
  {
    title: "Explore roadmaps",
    description: "Browse guided paths through the skills and concepts you want to learn.",
    to: "/roadmaps",
    icon: Map,
  },
  {
    title: "Build a roadmap",
    description: "Shape a learning path around your goals, starting point, and weekly time.",
    to: "/build",
    icon: Sparkles,
  },
  {
    title: "Browse papers",
    description: "Find useful reading alongside your learning journey.",
    to: "/papers",
    icon: Library,
  },
  {
    title: "Explore repositories",
    description: "Visualize a codebase and see how its parts fit together.",
    to: "/repos",
    icon: GitFork,
  },
] as const;

function HomePage() {
  return (
    <div>
      <section className="border-b border-border bg-secondary/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end lg:px-8">
          <div className="max-w-3xl">
            <p className="flex items-center gap-2 text-sm font-semibold text-primary">
              <BookOpen className="size-4" aria-hidden="true" />
              A learning space for curious builders
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-tight text-foreground sm:text-5xl">
              Learn tech, one clear step at a time.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              Find a direction, follow a practical roadmap, and keep moving at your own pace.
            </p>
          </div>
          <Button asChild size="lg" className="w-fit">
            <Link to="/build">
              Start with a goal <ArrowRight className="ml-2 size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-7">
          <h2 className="text-2xl font-bold text-foreground">Choose your next step</h2>
          <p className="mt-2 text-sm text-muted-foreground">Start with a path that fits what you want to do.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {destinations.map(({ title, description, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex min-h-36 items-start gap-4 border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-foreground">{title}</span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">{description}</span>
              </span>
              <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}