import { Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLogin, useSignup } from "@/lib/queries";
import { safeRedirect } from "@/lib/redirect";
import { ApiError, type FieldError } from "@/lib/types";

interface AuthFormProps {
  mode: "login" | "signup";
  redirect: string | undefined;
}

type FieldName = "name" | "email" | "password";

/** Login and signup share one form. The server is the source of truth for validation. */
export function AuthForm({ mode, redirect }: AuthFormProps) {
  const navigate = useNavigate();
  const loginMutation = useLogin();
  const signupMutation = useSignup();
  const mutation = mode === "login" ? loginMutation : signupMutation;
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});

  const target = safeRedirect(redirect);
  const isSignup = mode === "signup";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const onSuccess = () => void navigate({ href: target, replace: true });
    const onError = (error: Error) => {
      if (error instanceof ApiError && error.code === "VALIDATION_ERROR") {
        const next: Partial<Record<FieldName, string>> = {};
        for (const item of (error.details as FieldError[] | undefined) ?? []) {
          if (item.field === "name" || item.field === "email" || item.field === "password") {
            next[item.field] = item.message.replace(/^Value error, /, "");
          }
        }
        setFieldErrors(next);
        setFormError(Object.keys(next).length ? null : error.message);
        return;
      }
      setFormError(error.message || "Something went wrong. Please try again.");
    };

    if (isSignup) {
      signupMutation.mutate(
        { name: String(form.get("name") ?? ""), email, password },
        { onSuccess, onError },
      );
    } else {
      loginMutation.mutate({ email, password }, { onSuccess, onError });
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12 sm:py-20">
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {isSignup ? "Create your account" : "Welcome back"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {isSignup
          ? "Free forever for learners. Save your roadmaps and progress."
          : "Log in to continue your roadmaps."}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <Field label="Name" name="name" error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              required
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.name)}
            />
          </Field>
        )}
        <Field label="Email" name="email" error={fieldErrors.email}>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={320}
            aria-invalid={Boolean(fieldErrors.email)}
          />
        </Field>
        <Field
          label="Password"
          name="password"
          error={fieldErrors.password}
          hint={isSignup ? "At least 8 characters." : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            required
            minLength={isSignup ? 8 : undefined}
            maxLength={128}
            aria-invalid={Boolean(fieldErrors.password)}
          />
        </Field>

        {formError && (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSignup ? "Create account" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link
          to={isSignup ? "/login" : "/signup"}
          search={redirect ? { redirect } : {}}
          className="font-medium text-primary hover:underline"
        >
          {isSignup ? "Log in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

interface FieldProps {
  label: string;
  name: FieldName;
  error: string | undefined;
  hint?: string | undefined;
  children: React.ReactNode;
}

function Field({ label, name, error, hint, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
