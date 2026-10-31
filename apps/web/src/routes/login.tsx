import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "@/components/auth/auth-form";
import { pageMeta } from "@/lib/seo";

interface AuthSearch {
  redirect?: string;
}

export const Route = createFileRoute("/login")({
  // Keep only a string redirect; safeRedirect() validates it before we navigate.
  validateSearch: (search: Record<string, unknown>): AuthSearch =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () => pageMeta("Log in", "Log in to continue your PadhLo roadmaps."),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return <AuthForm mode="login" redirect={redirect} />;
}
