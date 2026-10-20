import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/papers/$id")({
  head: () =>
    pageMeta(
      "Paper",
      "Summary, key ideas and a step-by-step implementation guide. Coming on Day 3.",
    ),
  component: Page,
});

function Page() {
  return (
    <ShellPage
      title="Paper"
      description="Summary, key ideas and a step-by-step implementation guide. Coming on Day 3."
    />
  );
}
