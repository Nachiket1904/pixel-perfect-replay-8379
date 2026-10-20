import { Check, ChevronRight, Code2, FileText } from "lucide-react";

import { statusDotClass, statusLabel } from "@/components/roadmap/status";
import { topologicalLevels } from "@/lib/graph";
import type { Roadmap } from "@/lib/types";

interface RoadmapListProps {
  roadmap: Roadmap;
  onSelect: (nodeId: string) => void;
}

export function RoadmapList({ roadmap, onSelect }: RoadmapListProps) {
  const levels = topologicalLevels(roadmap.nodes, roadmap.edges);

  return (
    <ol className="space-y-6">
      {levels.map((level, index) => (
        <li key={level.map((n) => n.id).join("|")}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Step {index + 1}
            {level.length > 1 && " · pick any order"}
          </p>
          <ul className="space-y-2">
            {level.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => onSelect(n.id)}
                  className="flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/50"
                >
                  <span className="mt-1 flex size-5 shrink-0 items-center justify-center">
                    {n.status === "done" ? (
                      <span className="flex size-5 items-center justify-center rounded-full bg-success text-white">
                        <Check className="size-3.5" aria-hidden="true" />
                      </span>
                    ) : (
                      <span
                        className={`size-3 rounded-full ${statusDotClass[n.status]}`}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {n.title}
                      {n.node_type === "milestone" && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                          Milestone
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                      {n.summary}
                    </span>
                    <span className="mt-1 flex gap-3 text-xs text-muted-foreground">
                      <span className="sr-only">Status: </span>
                      {statusLabel[n.status]}
                      {n.has_exercise && (
                        <span className="flex items-center gap-1">
                          <Code2 className="size-3" aria-hidden="true" />
                          Exercise
                        </span>
                      )}
                      {n.linked_paper_id && (
                        <span className="flex items-center gap-1">
                          <FileText className="size-3" aria-hidden="true" />
                          Paper
                        </span>
                      )}
                    </span>
                  </span>
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
