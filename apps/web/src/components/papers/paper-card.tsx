import { Link } from "@tanstack/react-router";
import { Code2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaperSummary } from "@/lib/types";

export function formatAuthors(authors: string[], max = 3): string {
  if (authors.length <= max) return authors.join(", ");
  return `${authors.slice(0, max).join(", ")} et al.`;
}

export function PaperCard({ paper }: { paper: PaperSummary }) {
  return (
    <Link
      to="/papers/$id"
      params={{ id: paper.id }}
      className="group block rounded-lg border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/50"
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{paper.published_at.slice(0, 4)}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono">arXiv:{paper.external_id}</span>
        {paper.categories.map((c) => (
          <Badge key={c} variant="secondary" className="font-mono text-[10px]">
            {c}
          </Badge>
        ))}
      </div>
      <h3 className="mt-2 font-semibold leading-snug text-foreground group-hover:text-primary">
        {paper.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">{formatAuthors(paper.authors)}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
        {paper.short_description}
      </p>
      {paper.has_implementation && (
        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
          <Code2 className="size-4" aria-hidden="true" /> Step-by-step implementation guide
        </p>
      )}
    </Link>
  );
}

export function PaperCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-3 h-5 w-3/4" />
      <Skeleton className="mt-2 h-4 w-1/3" />
      <Skeleton className="mt-3 h-4 w-full" />
    </div>
  );
}
