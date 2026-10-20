import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/roadmaps")({
  head: () => ({
    meta: [
      { title: "Roadmaps | PadhLo With Us" },
      { name: "description", content: "Explore structured learning roadmaps for technology skills." },
      { property: "og:title", content: "Roadmaps | PadhLo With Us" },
      { property: "og:description", content: "Explore structured learning roadmaps for technology skills." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RoadmapsPage,
});

function RoadmapsPage() {
  return <ShellPage title="Roadmaps" description="Browse structured paths for building your skills in technology." />;
}