import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Button } from "@/components/ui/button";
import type { RepoAnalysis } from "@/lib/repos-api";
import {
  type GraphData,
  type GraphNodeData,
  type RepoIndex,
  dirOf,
  fileGraph,
  folderGraph,
  folderLabel,
  layoutLayers,
} from "@/lib/repo-structure";
import { LangDot } from "./repo-ui";

/** Repos up to this many code files show every file at once instead of a folder map. */
export const SMALL_REPO_FILES = 40;

type ItemData = GraphNodeData & { highlight: boolean; dimmed: boolean };
type ItemNode = Node<ItemData, "item">;

function ItemNodeView({ data }: NodeProps<ItemNode>) {
  return (
    <div
      className={[
        "w-[220px] rounded-lg border bg-card px-3 py-2 text-card-foreground shadow-sm transition-opacity",
        data.highlight ? "border-primary ring-2 ring-primary/40" : "",
        data.outside ? "border-dashed" : "",
        data.dimmed ? "opacity-35" : "",
      ].join(" ")}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <div className="flex items-center gap-1.5">
        {data.kind === "folder" ? <span aria-hidden>📁</span> : <LangDot lang={data.lang} />}
        <span className={`truncate text-sm font-medium ${data.kind === "file" ? "font-mono" : ""}`} title={data.label}>
          {data.label}
        </span>
        {data.isEntry && (
          <span className="ml-auto text-xs text-primary" title="Entry point">
            ▶
          </span>
        )}
        {data.isCore && (
          <span className={`${data.isEntry ? "" : "ml-auto"} text-xs text-muted-foreground`} title="Core file">
            ★
          </span>
        )}
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{data.sublabel}</p>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { item: ItemNodeView };

/** Follows the app's light/dark theme (class on <html>), falling back to the OS setting. */
function useColorMode(): "light" | "dark" {
  const [mode, setMode] = useState<"light" | "dark">("light");
  useEffect(() => {
    const el = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const read = () => {
      if (el.classList.contains("dark")) setMode("dark");
      else if (el.classList.contains("light")) setMode("light");
      else setMode(media.matches ? "dark" : "light");
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    media.addEventListener("change", read);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", read);
    };
  }, []);
  return mode;
}

type Props = {
  analysis: RepoAnalysis;
  index: RepoIndex;
  folder: string | null; // null = overview map
  selectedFile: string | null;
  onOpenFolder: (folder: string | null) => void;
  onSelectFile: (path: string) => void;
};

export function DependencyMap({ analysis, index, folder, selectedFile, onOpenFolder, onSelectFile }: Props) {
  const colorMode = useColorMode();
  const small = analysis.files.length <= SMALL_REPO_FILES;
  const mode: "folders" | "files" = folder === null && !small ? "folders" : "files";

  const graph: GraphData = useMemo(
    () => (mode === "folders" ? folderGraph(analysis, index) : fileGraph(analysis, index, folder)),
    [analysis, index, mode, folder],
  );

  const focus = mode === "folders" ? (selectedFile ? dirOf(selectedFile) : null) : selectedFile;

  const { nodes, edges } = useMemo(() => {
    const positions = layoutLayers(
      graph.nodes.map((n) => n.id),
      graph.edges,
    );
    const neighbours = new Set<string>();
    if (focus) {
      for (const e of graph.edges) {
        if (e.from === focus) neighbours.add(e.to);
        if (e.to === focus) neighbours.add(e.from);
      }
    }
    const rfNodes: ItemNode[] = graph.nodes.map((n) => ({
      id: n.id,
      type: "item",
      position: positions.get(n.id) ?? { x: 0, y: 0 },
      data: {
        ...n,
        highlight: n.id === focus,
        dimmed: !!focus && n.id !== focus && !neighbours.has(n.id),
      },
    }));
    const rfEdges: Edge[] = graph.edges.map((e) => {
      const touches = !!focus && (e.from === focus || e.to === focus);
      const edge: Edge = {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: touches,
      };
      if (e.count && e.count > 1) edge.label = String(e.count);
      if (touches) edge.style = { strokeWidth: 2 };
      else if (focus) edge.style = { opacity: 0.25 };
      return edge;
    });
    return { nodes: rfNodes, edges: rfEdges };
  }, [graph, focus]);

  const insideCount = graph.nodes.filter((n) => !n.outside).length;
  const title =
    mode === "folders" ? "Map of folders" : folder === null ? "All files" : `Files in ${folderLabel(folder)}`;

  return (
    <section className="space-y-2 rounded-lg border p-3" aria-label="Dependency map">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{title}</h3>
        {mode === "files" && folder !== null && !small && (
          <Button variant="outline" size="sm" onClick={() => onOpenFolder(null)}>
            ← All folders
          </Button>
        )}
        <p className="w-full text-xs text-muted-foreground">
          {mode === "folders"
            ? "Each box is a folder; arrows point to the folders it uses. Click a folder to see its files."
            : "Arrows point from a file to the files it imports. Dashed boxes live in other folders. Click a file to explore it."}
        </p>
      </div>

      {insideCount === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          No code files directly in this folder. Pick one of its subfolders on the left.
        </p>
      ) : (
        <div className="h-[480px] overflow-hidden rounded-md border">
          <ReactFlow
            key={`${mode}:${folder ?? ""}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode={colorMode}
            onNodeClick={(_, node) => {
              if (mode === "folders") onOpenFolder(node.id);
              else onSelectFile(node.id);
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1.2 }}
            minZoom={0.1}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </div>
      )}
    </section>
  );
}
