// Small shared bits for the repo visualizer.
import type { ReactNode } from "react";
import type { RepoFileInfo } from "@/lib/repos-api";

export const LANG_COLORS: Record<RepoFileInfo["lang"], string> = {
  python: "#3b82f6",
  typescript: "#8b5cf6",
  javascript: "#f59e0b",
};

export const LANG_NAMES: Record<string, string> = {
  python: "Python",
  typescript: "TypeScript",
  javascript: "JavaScript",
};

export function LangDot({ lang }: { lang?: RepoFileInfo["lang"] | undefined }) {
  if (!lang) return null;
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: LANG_COLORS[lang] }}
    />
  );
}

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "primary" }) {
  return (
    <span
      className={
        tone === "primary"
          ? "inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          : "inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
      }
    >
      {children}
    </span>
  );
}

export function FileLink({
  path,
  onClick,
  label,
}: {
  path: string;
  onClick: (path: string) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(path)}
      className="max-w-full truncate rounded-md border px-2 py-0.5 text-left font-mono text-xs hover:bg-accent"
      title={path}
    >
      {label ?? path}
    </button>
  );
}
