import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";
import { pageMeta } from "@/lib/seo";

export const Route = createFileRoute("/signup")({
  head: () => pageMeta("Sign up", "Create your free account. Coming on Day 7."),
  component: Page,
});

function Page() {
  return <ShellPage title="Sign up" description="Create your free account. Coming on Day 7." />;
}
