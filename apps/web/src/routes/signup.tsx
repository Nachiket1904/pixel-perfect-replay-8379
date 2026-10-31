import { createFileRoute } from "@tanstack/react-router";

import { AuthForm } from "@/components/auth/auth-form";
import { pageMeta } from "@/lib/seo";

interface AuthSearch {
  redirect?: string;
}

export const Route = createFileRoute("/signup")({
  // Keep only a string redirect; safeRedirect() validates it before we navigate.
  validateSearch: (search: Record<string, unknown>): AuthSearch =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},
  head: () =>
    pageMeta("Sign up", "Create a free PadhLo account to save your roadmaps and progress."),
  component: SignupPage,
});

function SignupPage() {
  const { redirect } = Route.useSearch();
  return <AuthForm mode="signup" redirect={redirect} />;
}
