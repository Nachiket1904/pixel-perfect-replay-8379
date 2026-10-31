import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useLogout, useMe } from "@/lib/queries";

interface AuthMenuProps {
  /** "desktop" sits in the header bar, "mobile" fills the mobile menu. */
  variant: "desktop" | "mobile";
  onNavigate?: () => void;
}

export function AuthMenu({ variant, onNavigate }: AuthMenuProps) {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const full = variant === "mobile" ? "w-full" : "";

  // Until we know (SSR and first load), render a fixed-size placeholder so the header doesn't jump.
  if (me.isPending) return <div className={variant === "mobile" ? "h-10" : "h-9 w-36"} />;

  if (!me.data) {
    return (
      <div className={variant === "mobile" ? "mt-2 grid gap-2" : "flex items-center gap-2"}>
        <Button variant="outline" size="sm" className={full} asChild>
          <Link to="/login" onClick={onNavigate}>
            Log in
          </Link>
        </Button>
        <Button size="sm" className={full} asChild>
          <Link to="/signup" onClick={onNavigate}>
            Sign up
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className={variant === "mobile" ? "mt-2 grid gap-2" : "flex items-center gap-2"}>
      <Button variant="ghost" size="sm" className={full} asChild>
        <Link to="/dashboard" onClick={onNavigate}>
          {me.data.name.split(" ")[0]}'s dashboard
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        className={full}
        disabled={logout.isPending}
        onClick={() =>
          logout.mutate(undefined, {
            onSettled: () => {
              onNavigate?.();
              void navigate({ to: "/" });
            },
          })
        }
      >
        <LogOut className="size-4" aria-hidden="true" />
        Log out
      </Button>
    </div>
  );
}
