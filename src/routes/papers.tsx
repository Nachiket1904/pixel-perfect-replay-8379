import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/papers")({
  head: () => ({
    meta: [
      { title: "Papers | PadhLo With Us" },
      { name: "description", content: "Browse useful papers and reading for your technology learning journey." },
      { property: "og:title", content: "Papers | PadhLo With Us" },
      { property: "og:description", content: "Browse useful papers and reading for your technology learning journey." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PapersPage,
});

function PapersPage() {
  return <ShellPage title="Papers" description="Find reading to support the concepts you are learning." />;
}