import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms | PadhLo With Us" },
      { name: "description", content: "Read the PadhLo With Us terms of use." },
      { property: "og:title", content: "Terms | PadhLo With Us" },
      { property: "og:description", content: "Read the PadhLo With Us terms of use." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return <ShellPage title="Terms" description="Terms of use will be available here." />;
}
