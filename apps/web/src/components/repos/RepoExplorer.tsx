import { useMemo, useRef, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeRepo, getRepo, getRepoStructure, type RepoStructure } from "@/lib/repos-api";
import { buildIndex, buildTree, dirOf } from "@/lib/repo-structure";
import { DependencyMap, SMALL_REPO_FILES } from "./DependencyMap";
import { FilePanel } from "./FilePanel";
import { FolderTree } from "./FolderTree";
import { RepoOverview } from "./RepoOverview";

const BUSY = new Set(["pending", "syncing"]);

export function RepoExplorer() {
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
  const structure = useQuery({
    queryKey: ["repo-structure", repoId, status.data?.commit_sha],
    queryFn: () => getRepoStructure(repoId!),
    enabled: !!repoId && ready,
    staleTime: 10 * 60 * 1000,
  });

  const busy = analyze.isPending || (!!status.data && BUSY.has(status.data.sync_status));

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
        <Button type="submit" disabled={busy}>
          {busy ? "Analyzing…" : "Explore repository"}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        Works with public repositories. Python, JavaScript and TypeScript code is analyzed.
      </p>

      {analyze.isError && <p className="text-sm text-destructive">{analyze.error.message}</p>}
      {status.data && BUSY.has(status.data.sync_status) && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Reading the code of {status.data.full_name}. Bigger projects take up to a minute.
        </p>
      )}
      {status.data?.sync_status === "failed" && (
        <p className="text-sm text-destructive">{status.data.sync_error}</p>
      )}
      {structure.isError && <p className="text-sm text-destructive">{structure.error.message}</p>}
      {ready && structure.isPending && (
        <p className="text-sm text-muted-foreground">Loading the map…</p>
      )}

      {structure.data && <Workspace key={structure.data.repo.id} structure={structure.data} />}
    </div>
  );
}

function Workspace({ structure }: { structure: RepoStructure }) {
  const { repo, analysis } = structure;
  const index = useMemo(() => buildIndex(analysis), [analysis]);
  const tree = useMemo(() => buildTree(analysis.files.map((f) => f.path)), [analysis]);
  const small = analysis.files.length <= SMALL_REPO_FILES;

  const [folder, setFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function selectFile(path: string, symbolId: string | null = null) {
    setSelectedFile(path);
    setSelectedSymbol(symbolId);
    if (!small) setFolder(dirOf(path));
    // Bring the file panel into view if it's below the fold.
    requestAnimationFrame(() => {
      const el = panelRef.current;
      if (el && el.getBoundingClientRect().top > window.innerHeight * 0.75) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  if (analysis.files.length === 0) {
    return (
      <div className="space-y-4">
        <RepoOverview repo={repo} analysis={analysis} onSelectFile={selectFile} />
        <p className="text-sm text-muted-foreground">
          No Python, JavaScript or TypeScript files were found in this repository.
        </p>
      </div>
    );
  }

  const file = selectedFile ? index.files.get(selectedFile) : undefined;

  return (
    <div className="space-y-6">
      <RepoOverview repo={repo} analysis={analysis} onSelectFile={selectFile} />
      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <FolderTree
          root={tree}
          index={index}
          selectedFile={selectedFile}
          openFolder={folder}
          onSelectFile={selectFile}
          onOpenFolder={setFolder}
        />
        <div className="min-w-0 space-y-4">
          <DependencyMap
            analysis={analysis}
            index={index}
            folder={folder}
            selectedFile={selectedFile}
            onOpenFolder={setFolder}
            onSelectFile={selectFile}
          />
          <div ref={panelRef} className="scroll-mt-4">
            {file ? (
              <FilePanel
                repo={repo}
                file={file}
                index={index}
                selectedSymbol={selectedSymbol}
                onSelectFile={selectFile}
                onSelectSymbol={setSelectedSymbol}
              />
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Pick a file in the map, the folder list or the reading order to see what it does,
                what it uses and how its functions call each other.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
