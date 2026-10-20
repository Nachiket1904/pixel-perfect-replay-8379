import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About | PadhLo With Us" },
      { name: "description", content: "Learn about PadhLo With Us, a learning space for curious builders." },
      { property: "og:title", content: "About | PadhLo With Us" },
      { property: "og:description", content: "Learn about PadhLo With Us, a learning space for curious builders." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return <ShellPage title="About PadhLo With Us" description="A learning space for Indian CS and IT students and early-career developers." />;
}