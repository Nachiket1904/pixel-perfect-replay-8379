import { createFileRoute } from "@tanstack/react-router";

import { ShellPage } from "@/components/shell-page";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in | PadhLo With Us" },
      { name: "description", content: "Log in to PadhLo With Us." },
      { property: "og:title", content: "Log in | PadhLo With Us" },
      { property: "og:description", content: "Log in to PadhLo With Us." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  return <ShellPage title="Log in" description="Your learning space is ready when you are." />;
}