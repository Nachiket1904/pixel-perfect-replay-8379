import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getRepoFile, type RepoFileInfo, type RepoSummary, type RepoSymbol } from "@/lib/repos-api";
import { type RepoIndex, baseName, splitSymbolId } from "@/lib/repo-structure";
import { Badge, FileLink, LANG_NAMES } from "./repo-ui";

type Props = {
  repo: RepoSummary;
  file: RepoFileInfo;
  index: RepoIndex;
  selectedSymbol: string | null;
  onSelectFile: (path: string, symbolId?: string | null) => void;
  onSelectSymbol: (id: string | null) => void;
};

const KIND_LABEL: Record<RepoSymbol["kind"], string> = {
  function: "function",
  method: "method",
  class: "class",
  component: "component",
};

export function FilePanel({
  repo,
  file,
  index,
  selectedSymbol,
  onSelectFile,
  onSelectSymbol,
}: Props) {
  const [showCode, setShowCode] = useState(false);

  // Jump to another symbol: same file just selects it, another file opens that file.
  const goTo = (id: string) => {
    const { file: path } = splitSymbolId(id);
    if (path === file.path) onSelectSymbol(id);
    else if (index.files.has(path)) onSelectFile(path, id.endsWith("::(module)") ? null : id);
    setShowCode(true);
  };

  const symbolLabel = (id: string) => {
    const { file: path, name } = splitSymbolId(id);
    if (name === "(module)") return `${baseName(path)} (top level)`;
    return path === file.path ? name : `${name} · ${baseName(path)}`;
  };

  const githubUrl = `https://github.com/${repo.full_name}/blob/${repo.commit_sha ?? repo.default_branch ?? "HEAD"}/${file.path}`;

  return (
    <section className="space-y-5 rounded-lg border p-4" aria-label={`File ${file.path}`}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="break-all font-mono text-base font-semibold">{file.path}</h3>
          {index.entries.has(file.path) && <Badge tone="primary">entry point</Badge>}
          {index.core.has(file.path) && <Badge>core file</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          {LANG_NAMES[file.lang]} · {file.lines} lines ·{" "}
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            open on GitHub
          </a>
        </p>
        <p className="pt-1 leading-7">
          {file.summary ?? (
            <span className="text-muted-foreground">This file has no description comment.</span>
          )}
        </p>
        {file.parse_error && (
          <p className="text-sm text-destructive">
            This file couldn't be parsed, so its details may be incomplete.
          </p>
        )}
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <LinkList
          title="Uses (imports)"
          empty="Doesn't import other files in this repo."
          paths={file.imports}
          onClick={onSelectFile}
        />
        <LinkList
          title="Used by"
          empty="No other file imports this one."
          paths={file.imported_by}
          onClick={onSelectFile}
        />
      </div>

      {file.externals.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Libraries it uses</h4>
          <div className="flex flex-wrap gap-1.5">
            {file.externals.map((lib) => (
              <Badge key={lib}>{lib}</Badge>
            ))}
          </div>
        </div>
      )}

      {file.module_calls.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">When this file runs, it calls</h4>
          <div className="flex flex-wrap gap-1.5">
            {file.module_calls.map((id) => (
              <CallButton key={id} label={symbolLabel(id)} onClick={() => goTo(id)} />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="text-sm font-medium">Functions and classes ({file.symbols.length})</h4>
          {file.lang !== "python" && (
            <span className="text-xs text-muted-foreground">
              Call links for JS/TS are best-effort.
            </span>
          )}
        </div>
        {file.symbols.length === 0 ? (
          <p className="text-sm text-muted-foreground">No top-level functions or classes found.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {file.symbols.map((s) => {
              const open = s.id === selectedSymbol;
              const callers = index.calledBy.get(s.id) ?? [];
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectSymbol(open ? null : s.id);
                      if (!open) setShowCode(true);
                    }}
                    aria-expanded={open}
                    className={`flex w-full items-baseline gap-2 px-3 py-2 text-left hover:bg-accent ${open ? "bg-accent" : ""}`}
                  >
                    <span className="w-20 shrink-0 text-xs text-muted-foreground">
                      {KIND_LABEL[s.kind]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-sm">{s.name}</span>
                      {s.summary && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {s.summary}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">line {s.line}</span>
                  </button>
                  {open && (
                    <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2">
                      <CallList
                        title="Calls →"
                        empty="Doesn't call other code in this repo."
                        ids={s.calls}
                        label={symbolLabel}
                        onClick={goTo}
                      />
                      <CallList
                        title="← Called by"
                        empty="Nothing in this repo calls it directly."
                        ids={callers}
                        label={symbolLabel}
                        onClick={goTo}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCode((v) => !v)}
          aria-expanded={showCode}
        >
          {showCode ? "Hide code" : "Show code"}
        </Button>
        {showCode && <CodeView repoId={repo.id} file={file} selectedSymbol={selectedSymbol} />}
      </div>
    </section>
  );
}

function LinkList({
  title,
  empty,
  paths,
  onClick,
}: {
  title: string;
  empty: string;
  paths: string[];
  onClick: (path: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <h4 className="text-sm font-medium">
        {title}{" "}
        {paths.length > 0 && <span className="text-muted-foreground">({paths.length})</span>}
      </h4>
      {paths.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex max-h-40 flex-wrap gap-1.5 overflow-auto">
          {paths.map((p) => (
            <FileLink key={p} path={p} onClick={onClick} />
          ))}
        </div>
      )}
    </div>
  );
}

function CallButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="max-w-full truncate rounded-md border px-2 py-0.5 text-left font-mono text-xs hover:bg-accent"
      title={label}
    >
      {label}
    </button>
  );
}

function CallList({
  title,
  empty,
  ids,
  label,
  onClick,
}: {
  title: string;
  empty: string;
  ids: string[];
  label: (id: string) => string;
  onClick: (id: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium">{title}</p>
      {ids.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <CallButton key={id} label={label(id)} onClick={() => onClick(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function CodeView({
  repoId,
  file,
  selectedSymbol,
}: {
  repoId: string;
  file: RepoFileInfo;
  selectedSymbol: string | null;
}) {
  const query = useQuery({
    queryKey: ["repo-file", repoId, file.path],
    queryFn: () => getRepoFile(repoId, file.path),
    staleTime: 60 * 60 * 1000,
  });
  const boxRef = useRef<HTMLDivElement>(null);
  const symbol = file.symbols.find((s) => s.id === selectedSymbol);

  // Scroll the code box (not the page) to the selected function.
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !symbol || !query.data) return;
    const line = box.querySelector<HTMLElement>(`[data-line="${symbol.line}"]`);
    if (line) box.scrollTop = line.offsetTop - box.clientHeight / 3;
  }, [symbol, query.data]);

  if (query.isPending) return <p className="text-sm text-muted-foreground">Loading code…</p>;
  if (query.isError) return <p className="text-sm text-destructive">{query.error.message}</p>;

  const lines = query.data.content.split("\n");
  return (
    <div className="space-y-1">
      <div
        ref={boxRef}
        className="relative max-h-[520px] overflow-auto rounded-md border bg-muted/40"
      >
        <pre className="text-xs leading-5">
          <code>
            {lines.map((text, i) => {
              const n = i + 1;
              const hit = symbol?.line === n;
              return (
                <div key={n} data-line={n} className={`flex ${hit ? "bg-primary/15" : ""}`}>
                  <span className="sticky left-0 w-12 shrink-0 select-none bg-muted/80 pr-3 text-right text-muted-foreground">
                    {n}
                  </span>
                  <span className="whitespace-pre pl-3 pr-4">{text || " "}</span>
                </div>
              );
            })}
          </code>
        </pre>
      </div>
      {query.data.truncated && (
        <p className="text-xs text-muted-foreground">Only the first part of this file is shown.</p>
      )}
    </div>
  );
}
