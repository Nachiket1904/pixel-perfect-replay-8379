import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaperCard, PaperCardSkeleton } from "@/components/papers/paper-card";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { pageMeta } from "@/lib/seo";
import { usePaperSearch } from "@/lib/queries";
import { cn } from "@/lib/utils";

interface PapersSearch {
  q?: string;
  category?: string;
}

const categories = [
  { value: "cs.LG", label: "Machine learning" },
  { value: "cs.CL", label: "Language (NLP)" },
  { value: "cs.CV", label: "Vision" },
];

/** Set or remove one search param (exactOptionalPropertyTypes forbids `key: undefined`). */
function withParam(
  prev: PapersSearch,
  key: keyof PapersSearch,
  value: string | undefined,
): PapersSearch {
  const next = { ...prev };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

export const Route = createFileRoute("/papers/")({
  // URL is the source of truth so searches can be shared and bookmarked.
  validateSearch: (search: Record<string, unknown>): PapersSearch => {
    const out: PapersSearch = {};
    if (typeof search["q"] === "string" && search["q"].trim()) out.q = search["q"].slice(0, 200);
    if (
      typeof search["category"] === "string" &&
      categories.some((c) => c.value === search["category"])
    ) {
      out.category = search["category"];
    }
    return out;
  },
  head: () =>
    pageMeta(
      "Paper to Code Lab",
      "Search research papers, read plain-language summaries and implement them step by step.",
    ),
  component: PapersPage,
});

function PapersPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/papers/" });
  const [input, setInput] = useState(search.q ?? "");
  const debounced = useDebouncedValue(input.trim(), 350);

  // Push the debounced text into the URL (replace, so typing doesn't spam history).
  useEffect(() => {
    if (debounced === (search.q ?? "")) return;
    void navigate({
      search: (prev) => withParam(prev, "q", debounced),
      replace: true,
    });
  }, [debounced, navigate, search.q]);

  const params = {
    ...(search.q ? { q: search.q } : {}),
    ...(search.category ? { category: search.category } : {}),
  };
  const results = usePaperSearch(params);

  const setCategory = (value: string | undefined) =>
    void navigate({ search: (prev) => withParam(prev, "category", value), replace: true });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        Paper to Code Lab
      </h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Read famous research papers in plain language, then implement them step by step. Original
        PDFs stay on arXiv.
      </p>

      <div className="relative mt-6">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <label htmlFor="paper-search" className="sr-only">
          Search papers
        </label>
        <Input
          id="paper-search"
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, 200))}
          placeholder="Search by title, author or arXiv id (e.g. attention)"
          className="h-11 pl-9"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <CategoryChip active={!search.category} onClick={() => setCategory(undefined)}>
          All
        </CategoryChip>
        {categories.map((c) => (
          <CategoryChip
            key={c.value}
            active={search.category === c.value}
            onClick={() => setCategory(c.value)}
          >
            {c.label}
          </CategoryChip>
        ))}
      </div>

      <div
        className={cn(
          "mt-6 space-y-4",
          results.isFetching && results.data && "opacity-60 transition-opacity",
        )}
      >
        {!search.q && !search.category && results.data && (
          <p className="text-sm font-medium text-muted-foreground">
            Start with these. Papers with a guide are marked.
          </p>
        )}
        {results.isPending && [0, 1, 2].map((i) => <PaperCardSkeleton key={i} />)}
        {results.isError && (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Search failed. Please try again.</p>
            <Button variant="outline" className="mt-3" onClick={() => void results.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {results.data?.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <p className="font-medium text-foreground">No papers found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a shorter query, or remove the category filter.
            </p>
          </div>
        )}
        {results.data?.map((p) => (
          <PaperCard key={p.id} paper={p} />
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
