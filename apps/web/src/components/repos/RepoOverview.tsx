import type { RepoAnalysis, RepoSummary } from "@/lib/repos-api";
import { Badge, FileLink, LANG_NAMES } from "./repo-ui";

type Props = {
  repo: RepoSummary;
  analysis: RepoAnalysis;
  onSelectFile: (path: string) => void;
};

export function RepoOverview({ repo, analysis, onSelectFile }: Props) {
  const { stats } = analysis;
  const languages = Object.entries(stats.languages)
    .map(([lang, n]) => `${LANG_NAMES[lang] ?? lang} (${n})`)
    .join(", ");

  return (
    <section className="space-y-5 rounded-lg border p-5" aria-label="Repository overview">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">
          <a
            href={`https://github.com/${repo.full_name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {repo.full_name}
          </a>
        </h2>
        <p className="text-sm text-muted-foreground">
          {stats.code_files} code files, {stats.lines.toLocaleString()} lines · {languages || "no supported code"} ·{" "}
          {repo.stars.toLocaleString()} stars
        </p>
        {stats.truncated && (
          <p className="text-xs text-muted-foreground">
            This repository is large, so only part of it was analyzed.
          </p>
        )}
      </div>

      {(analysis.readme || repo.description) && (
        <p className="max-w-3xl leading-7">{analysis.readme ?? repo.description}</p>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="font-medium">Start here: suggested reading order</h3>
          {analysis.reading_order.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clear starting point found. Try the folders on the left.</p>
          ) : (
            <ol className="space-y-1.5 text-sm">
              {analysis.reading_order.map((path, i) => (
                <li key={path} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-muted-foreground">{i + 1}.</span>
                  <FileLink path={path} onClick={onSelectFile} />
                  {analysis.entry_points.includes(path) && <Badge tone="primary">entry point</Badge>}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="space-y-4">
          {analysis.core_files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Core files</h3>
              <p className="text-xs text-muted-foreground">Used by many other files. Understand these and the rest gets easier.</p>
              <div className="flex flex-wrap gap-1.5">
                {analysis.core_files.map((path) => (
                  <FileLink key={path} path={path} onClick={onSelectFile} />
                ))}
              </div>
            </div>
          )}
          {analysis.libraries.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Main libraries</h3>
              <div className="flex flex-wrap gap-1.5">
                {analysis.libraries.map((lib) => (
                  <Badge key={lib.name}>
                    {lib.name} · {lib.files}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
