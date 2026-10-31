import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/queries";

/**
 * Client-side gate for pages that need a logged-in user. This is UX only: the API checks
 * auth on every request, so hiding a page here is never the security boundary.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const navigate = useNavigate();
  const location = useLocation();
  const loggedOut = me.isSuccess && me.data === null;

  useEffect(() => {
    if (loggedOut) {
      void navigate({ to: "/login", search: { redirect: location.href }, replace: true });
    }
  }, [loggedOut, navigate, location.href]);

  if (me.isError) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">We couldn't check your session.</p>
        <Button className="mt-4" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    );
  }
  if (!me.data) {
    return (
      <div className="flex justify-center py-24" aria-live="polite">
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }
  return <>{children}</>;
}
