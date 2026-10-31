import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy | PadhLo With Us" },
      { name: "description", content: "Read the PadhLo With Us privacy information." },
      { property: "og:title", content: "Privacy | PadhLo With Us" },
      { property: "og:description", content: "Read the PadhLo With Us privacy information." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <ShellPage title="Privacy" description="Privacy information will be available here." />;
}
