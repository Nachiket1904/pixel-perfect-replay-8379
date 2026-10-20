import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/build")({
  head: () => ({
    meta: [
      { title: "Build a roadmap | PadhLo With Us" },
      { name: "description", content: "Create a learning roadmap around your technology goals." },
      { property: "og:title", content: "Build a roadmap | PadhLo With Us" },
      { property: "og:description", content: "Create a learning roadmap around your technology goals." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuildPage,
});

function BuildPage() {
  return <ShellPage title="Build your roadmap" description="Tell us what you want to learn and make a path that fits your goals." />;
}