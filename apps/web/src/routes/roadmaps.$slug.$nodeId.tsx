import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Code2,
  ExternalLink,
  FileText,
  Search,
  Sparkles,
  Video,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CodeEditor } from "@/components/editor/code-editor";
import { useDraft } from "@/components/editor/use-draft";
import { Markdown } from "@/components/common/markdown";
import { ErrorState } from "@/components/common/states";
import { PaperCard } from "@/components/papers/paper-card";
import { showProgressError, statusDotClass, statusLabel } from "@/components/roadmap/status";
import { useNode, useUpdateNodeStatus } from "@/lib/queries";
import type { NodeDetail, NodeRef, NodeStatus, ResourceKind } from "@/lib/types";

export const Route = createFileRoute("/roadmaps/$slug/$nodeId")({
  head: () => ({ meta: [{ title: "Topic | PadhLo With Us" }] }),
  component: TopicPage,
});

function TopicPage() {
  const { slug, nodeId } = Route.useParams();
  const node = useNode(slug, nodeId);

  if (node.isPending) return <TopicSkeleton />;
  if (node.isError) {
    return (
      <ErrorState
        error={node.error}
        thing="topic"
        onRetry={() => void node.refetch()}
        backTo="/roadmaps"
        backLabel="All roadmaps"
      />
    );
  }
  return <TopicView node={node.data} />;
}

const statuses: NodeStatus[] = ["not_started", "in_progress", "done"];

const resourceIcon: Record<ResourceKind, typeof BookOpen> = {
  docs: BookOpen,
  article: FileText,
  course: BookOpen,
  video: Video,
  search: Search,
};

function TopicView({ node }: { node: NodeDetail }) {
  const updateStatus = useUpdateNodeStatus({ id: node.roadmap_id, slug: node.roadmap_slug });

  const onStatusChange = (status: NodeStatus) =>
    updateStatus.mutate({ nodeId: node.id, status }, { onError: showProgressError });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
        <Link to="/roadmaps" className="hover:text-foreground">
          Roadmaps
        </Link>
        <span className="mx-2" aria-hidden="true">
          /
        </span>
        <Link
          to="/roadmaps/$slug"
          params={{ slug: node.roadmap_slug }}
          className="hover:text-foreground"
        >
          {node.roadmap_title}
        </Link>
      </nav>

      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {node.node_type === "milestone" && <Badge className="bg-primary">Milestone</Badge>}
            {node.roadmap_source === "ai" && (
              <Badge variant="outline" className="gap-1 border-warning text-accent-foreground">
                <Sparkles className="size-3" aria-hidden="true" /> AI-generated topic
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {node.title}
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">{node.summary}</p>
        </div>
        <div className="w-full shrink-0 space-y-1.5 sm:w-48">
          <label htmlFor="topic-status" className="text-sm font-medium text-foreground">
            Your status
          </label>
          <Select value={node.status} onValueChange={(v) => onStatusChange(v as NodeStatus)}>
            <SelectTrigger id="topic-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-8">
          <section className="rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6">
            <Markdown>{node.content_md}</Markdown>
          </section>

          {node.node_type !== "milestone" && <PracticeSection node={node} />}

          <div className="flex flex-wrap justify-between gap-3 border-t border-border pt-6">
            <Button variant="outline" asChild>
              <Link to="/roadmaps/$slug" params={{ slug: node.roadmap_slug }}>
                <ArrowLeft className="mr-2 size-4" aria-hidden="true" /> Back to roadmap
              </Link>
            </Button>
            {node.status !== "done" && (
              <Button
                onClick={() => onStatusChange("done")}
                className="bg-success text-white hover:bg-success/90"
              >
                Mark as done
              </Button>
            )}
          </div>
        </main>

        <aside className="space-y-6">
          <section>
            <h2 className="font-semibold text-foreground">Free resources</h2>
            <ul className="mt-3 space-y-2">
              {node.resources.map((r) => {
                const Icon = resourceIcon[r.kind];
                return (
                  <li key={r.url}>
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                      className="flex items-start gap-3 rounded-md border border-border bg-card p-3 text-sm transition-colors hover:border-primary/50"
                    >
                      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="min-w-0 flex-1 text-foreground">{r.title}</span>
                      <ExternalLink
                        className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          <NodeRefList
            title="Before this"
            items={node.prerequisites}
            slug={node.roadmap_slug}
            empty="Nothing, start here."
          />
          <NodeRefList
            title="Unlocks next"
            items={node.unlocks}
            slug={node.roadmap_slug}
            empty="This is the end of the path."
          />

          {node.linked_paper && (
            <section>
              <h2 className="font-semibold text-foreground">Go deeper: research paper</h2>
              <div className="mt-3">
                <PaperCard paper={node.linked_paper} />
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function NodeRefList({
  title,
  items,
  slug,
  empty,
}: {
  title: string;
  items: NodeRef[];
  slug: string;
  empty: string;
}) {
  return (
    <section>
      <h2 className="font-semibold text-foreground">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {items.map((n) => (
            <li key={n.id}>
              <Link
                to="/roadmaps/$slug/$nodeId"
                params={{ slug, nodeId: n.id }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-secondary"
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ${statusDotClass[n.status]}`}
                  aria-hidden="true"
                />
                <span className="flex-1">{n.title}</span>
                <span className="sr-only">({statusLabel[n.status]})</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TopicSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-5 h-9 w-1/2" />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-80" />
        <Skeleton className="h-60" />
      </div>
    </div>
  );
}

function PracticeSection({ node }: { node: NodeDetail }) {
  const exercise = node.exercise;
  // Exercises load the editor straight away; the plain scratchpad waits for a click, so
  // learners who only read don't download the editor (about 2 MB) on every topic.
  const [open, setOpen] = useState(exercise !== null);
  const starter =
    exercise?.starter_code ??
    `# Scratchpad for "${node.title}"\n# Try the examples from this topic here.\n`;
  const [code, setCode] = useDraft(`${node.roadmap_slug}/${node.id}`, starter);

  return (
    <section aria-labelledby="practice-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="practice-heading" className="text-xl font-semibold text-foreground">
          {exercise ? `Practice: ${exercise.title}` : "Code scratchpad"}
        </h2>
        {!open && (
          <Button variant="outline" onClick={() => setOpen(true)}>
            <Code2 className="mr-2 size-4" aria-hidden="true" /> Open scratchpad
          </Button>
        )}
      </div>
      {open && (
        <>
          <CodeEditor
            label={exercise ? `Code for ${exercise.title}` : `Scratchpad for ${node.title}`}
            language={exercise?.language ?? "python"}
            value={code}
            onChange={setCode}
            initialValue={starter}
          />
          <p className="text-xs text-muted-foreground">
            Your code is saved in this browser. Running it here is coming soon.
          </p>
        </>
      )}
    </section>
  );
}
