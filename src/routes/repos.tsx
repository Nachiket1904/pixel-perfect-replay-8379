import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/repos")({
  head: () => ({
    meta: [
      { title: "Repo Visualizer | PadhLo With Us" },
      {
        name: "description",
        content: "Explore how files and modules in a code repository fit together.",
      },
      { property: "og:title", content: "Repo Visualizer | PadhLo With Us" },
      {
        property: "og:description",
        content: "Explore how files and modules in a code repository fit together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReposPage,
});

function ReposPage() {
  return (
    <ShellPage
      title="Repo Visualizer"
      description="See how a code repository is organized and how its pieces connect."
    />
  );
}
