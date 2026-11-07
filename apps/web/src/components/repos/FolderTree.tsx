import { useEffect, useState } from "react";
import type { RepoIndex, TreeNode } from "@/lib/repo-structure";
import { LangDot } from "./repo-ui";

type Props = {
  root: TreeNode;
  index: RepoIndex;
  selectedFile: string | null;
  openFolder: string | null;
  onSelectFile: (path: string) => void;
  onOpenFolder: (folder: string | null) => void; // null = map of all folders
};

const ancestors = (path: string) => {
  const parts = path.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
};

export function FolderTree({
  root,
  index,
  selectedFile,
  openFolder,
  onSelectFile,
  onOpenFolder,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(root.children.filter((c) => c.kind === "folder").map((c) => c.path)),
  );

  // Reveal the selected file in the tree.
  useEffect(() => {
    if (!selectedFile) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      ancestors(selectedFile).forEach((a) => next.add(a));
      return next;
    });
  }, [selectedFile]);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  function renderNode(node: TreeNode, depth: number) {
    const pad = { paddingLeft: `${depth * 12 + 4}px` };
    if (node.kind === "file") {
      const isSelected = node.path === selectedFile;
      return (
        <li key={node.path}>
          <button
            type="button"
            onClick={() => onSelectFile(node.path)}
            style={pad}
            className={`flex w-full items-center gap-1.5 rounded py-1 pr-2 text-left text-sm hover:bg-accent ${
              isSelected ? "bg-accent font-medium" : ""
            }`}
            aria-current={isSelected ? "true" : undefined}
          >
            <LangDot lang={index.files.get(node.path)?.lang} />
            <span className="truncate">{node.name}</span>
            {index.entries.has(node.path) && (
              <span className="text-xs text-primary" title="Entry point">
                ▶
              </span>
            )}
            {index.core.has(node.path) && (
              <span className="text-xs text-muted-foreground" title="Core file">
                ★
              </span>
            )}
          </button>
        </li>
      );
    }
    const isOpen = expanded.has(node.path);
    const meta = index.folders.get(node.path);
    const isMapped = openFolder === node.path;
    return (
      <li key={node.path}>
        <div
          style={pad}
          className={`flex items-start gap-1 rounded pr-2 ${isMapped ? "bg-accent/60" : ""}`}
        >
          <button
            type="button"
            onClick={() => toggle(node.path)}
            aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${node.name}`}
            className="mt-1 w-4 shrink-0 text-xs text-muted-foreground"
          >
            {isOpen ? "▾" : "▸"}
          </button>
          <button
            type="button"
            onClick={() => {
              onOpenFolder(node.path);
              if (!isOpen) toggle(node.path);
            }}
            className="min-w-0 flex-1 py-1 text-left hover:underline"
            title={meta?.summary ?? undefined}
          >
            <span className="block truncate text-sm font-medium">{node.name}/</span>
            {meta?.role && (
              <span className="block truncate text-xs text-muted-foreground">{meta.role}</span>
            )}
          </button>
        </div>
        {isOpen && <ul>{node.children.map((c) => renderNode(c, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <nav aria-label="Folders and files" className="rounded-lg border p-2">
      <div className="flex items-center justify-between px-1 pb-2">
        <h3 className="text-sm font-medium">Folders</h3>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:underline"
          onClick={() => onOpenFolder(null)}
        >
          map of all folders
        </button>
      </div>
      <ul className="max-h-[70vh] overflow-auto">{root.children.map((c) => renderNode(c, 0))}</ul>
      <p className="px-1 pt-2 text-xs text-muted-foreground">▶ entry point · ★ core file</p>
    </nav>
  );
}
