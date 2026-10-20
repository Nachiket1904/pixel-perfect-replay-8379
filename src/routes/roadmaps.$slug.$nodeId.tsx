import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/roadmaps/$slug/$nodeId")({
  head: () =>
    pageMeta("Topic", "Explanation, free resources and practice for this topic. Coming on Day 3."),
  component: Page,
});

function Page() {
  return (
    <ShellPage
      title="Topic"
      description="Explanation, free resources and practice for this topic. Coming on Day 3."
    />
  );
}
