import "@xyflow/react/dist/style.css";

import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { Check, FileText, Code2 } from "lucide-react";
import { useMemo } from "react";

import { statusNodeClass } from "@/components/roadmap/status";
import { cn } from "@/lib/utils";
import type { Roadmap, RoadmapNode } from "@/lib/types";

type TopicNodeData = { node: RoadmapNode };
type TopicFlowNode = Node<TopicNodeData, "topic">;

function TopicNode({ data }: NodeProps<TopicFlowNode>) {
  const n = data.node;
  const milestone = n.node_type === "milestone";
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm font-medium shadow-sm",
        milestone ? "w-64 border-primary" : "w-52",
        statusNodeClass[n.status],
        milestone && n.status === "not_started" && "border-primary",
      )}
    >
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      {n.status === "done" && <Check className="size-4 shrink-0" aria-hidden="true" />}
      {n.status === "in_progress" && (
        <span className="size-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1 leading-snug">{n.title}</span>
      {n.has_exercise && (
        <Code2 className="size-3.5 shrink-0 opacity-70" aria-label="Has exercise" />
      )}
      {n.linked_paper_id && (
        <FileText className="size-3.5 shrink-0 opacity-70" aria-label="Linked paper" />
      )}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { topic: TopicNode };

interface RoadmapGraphProps {
  roadmap: Roadmap;
  onSelect: (nodeId: string) => void;
}

export function RoadmapGraph({ roadmap, onSelect }: RoadmapGraphProps) {
  const nodes = useMemo<TopicFlowNode[]>(
    () =>
      roadmap.nodes.map((n) => ({
        id: n.id,
        type: "topic",
        // Centre nodes on their x position (cards are ~208px wide).
        position: { x: n.position.x - 104, y: n.position.y },
        data: { node: n },
      })),
    [roadmap.nodes],
  );

  const edges = useMemo<Edge[]>(
    () =>
      roadmap.edges.map((e) => ({
        id: e.id,
        source: e.from_node_id,
        target: e.to_node_id,
        type: "smoothstep",
        style: {
          stroke: "var(--primary)",
          strokeWidth: 1.5,
          ...(e.kind === "optional" ? { strokeDasharray: "6 4" } : {}),
        },
      })),
    [roadmap.edges],
  );

  const startNodes = useMemo(() => {
    const ys = [...new Set(roadmap.nodes.map((n) => n.position.y))].sort((a, b) => a - b);
    const cutoff = ys[Math.min(3, ys.length - 1)] ?? 0;
    return roadmap.nodes.filter((n) => n.position.y <= cutoff).map((n) => ({ id: n.id }));
  }, [roadmap.nodes]);

  return (
    // React Flow needs a parent with an explicit height or it renders nothing.
    <div className="h-[70vh] min-h-[420px] w-full overflow-hidden rounded-lg border border-border bg-card">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_event, node) => onSelect(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        // Fit on the first few topics so text is readable; learners pan down
        // to continue, like scrolling a roadmap.sh page.
        fitView
        fitViewOptions={{ nodes: startNodes, padding: 0.3, maxZoom: 1 }}
        panOnScroll
        zoomOnScroll={false}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background gap={24} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
