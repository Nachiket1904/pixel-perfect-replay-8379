import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/dashboard")({
  head: () => pageMeta("Dashboard", "Your roadmaps and the next topic to learn. Coming on Day 3."),
  component: Page,
});

function Page() {
  return (
    <ShellPage
      title="Dashboard"
      description="Your roadmaps and the next topic to learn. Coming on Day 3."
    />
  );
}
