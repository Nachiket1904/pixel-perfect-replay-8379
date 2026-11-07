import { createFileRoute } from "@tanstack/react-router";

import { RepoAnalyzer } from "@/components/repos/RepoAnalyzer";
import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/repos")({
  head: () => ({
    meta: [
      { title: "Repo Visualizer | PadhLo With Us" },
      {
        name: "description",
        content: "See how a GitHub project grew: its branches, versions and commit history.",
      },
      { property: "og:title", content: "Repo Visualizer | PadhLo With Us" },
      {
        property: "og:description",
        content: "See how a GitHub project grew: its branches, versions and commit history.",
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
      description="Paste a public GitHub repository to see its branches, versions and commit history."
    >
      <RepoAnalyzer />
    </ShellPage>
  );
}
