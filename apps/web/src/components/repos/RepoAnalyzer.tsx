import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeRepo, getRepo, getRepoGraph } from "@/lib/repos-api";
import { CommitGraph } from "./CommitGraph";

const BUSY = new Set(["pending", "syncing"]);
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "no date");

export function RepoAnalyzer() {
  const [url, setUrl] = useState("");
  const [repoId, setRepoId] = useState<string | null>(null);

  const analyze = useMutation({ mutationFn: analyzeRepo, onSuccess: (repo) => setRepoId(repo.id) });

  const status = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => getRepo(repoId!),
    enabled: !!repoId,
    refetchInterval: (q) => (q.state.data && BUSY.has(q.state.data.sync_status) ? 2000 : false),
  });

  const ready = status.data?.sync_status === "ok";
  const graph = useQuery({
    queryKey: ["repo-graph", repoId, status.data?.last_synced_at],
    queryFn: () => getRepoGraph(repoId!),
    enabled: !!repoId && ready,
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (url.trim()) analyze.mutate(url.trim());
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          aria-label="GitHub repository URL"
        />
        <Button type="submit" disabled={analyze.isPending || (!!status.data && BUSY.has(status.data.sync_status))}>
          {analyze.isPending ? "Starting…" : "Analyze repository"}
        </Button>
      </form>

      {analyze.isError && <p className="text-sm text-destructive">{analyze.error.message}</p>}
      {status.data && BUSY.has(status.data.sync_status) && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Reading {status.data.full_name} from GitHub. This takes a few seconds.
        </p>
      )}
      {status.data?.sync_status === "failed" && (
        <p className="text-sm text-destructive">{status.data.sync_error}</p>
      )}
      {graph.isError && <p className="text-sm text-destructive">{graph.error.message}</p>}

      {graph.data && (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold">{graph.data.repo.full_name}</h2>
            <p className="text-sm text-muted-foreground">
              {graph.data.repo.stars.toLocaleString()} stars
              {graph.data.repo.description ? `. ${graph.data.repo.description}` : ""}
            </p>
          </div>

          <CommitGraph
            repoFullName={graph.data.repo.full_name}
            commits={graph.data.commits}
            branches={graph.data.branches}
            tags={graph.data.tags}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Branches ({graph.data.branches.length})</h3>
              <ul className="max-h-72 space-y-1 overflow-auto text-sm">
                {graph.data.branches.map((b) => (
                  <li key={b.name} className="truncate">
                    {b.name} {b.is_default && <span className="text-xs text-primary">default</span>}
                  </li>
                ))}
              </ul>
            </section>
            <section className="rounded-lg border p-4">
              <h3 className="mb-2 font-medium">Versions ({graph.data.tags.length})</h3>
              {graph.data.tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">This repository has no tags yet.</p>
              ) : (
                <ul className="max-h-72 space-y-1 overflow-auto text-sm">
                  {graph.data.tags.map((t) => (
                    <li key={t.name} className="flex justify-between gap-2">
                      <span className="truncate">{t.name}</span>
                      <span className="shrink-0 text-muted-foreground">{fmtDate(t.released_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
