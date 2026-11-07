import { createFileRoute } from "@tanstack/react-router";

import { RepoExplorer } from "@/components/repos/RepoExplorer";
import { ShellPage } from "@/components/shell-page";

const DESCRIPTION =
  "See how a code repository is organized, how its files connect and how its functions call each other.";

export const Route = createFileRoute("/repos")({
  head: () => ({
    meta: [
      { title: "Repo Visualizer | PadhLo With Us" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Repo Visualizer | PadhLo With Us" },
      { property: "og:description", content: DESCRIPTION },
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
      description="Paste a public GitHub repository to see where to start reading, how its files connect and how its functions call each other."
    >
      <RepoExplorer />
    </ShellPage>
  );
}
