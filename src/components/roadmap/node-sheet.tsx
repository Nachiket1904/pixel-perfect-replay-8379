import { Link } from "@tanstack/react-router";
import { ArrowRight, Code2, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { statusLabel } from "@/components/roadmap/status";
import { useIsMobile } from "@/hooks/use-mobile";
import type { NodeStatus, RoadmapNode } from "@/lib/types";

interface NodeSheetProps {
  slug: string;
  node: RoadmapNode | null;
  onClose: () => void;
  onStatusChange: (nodeId: string, status: NodeStatus) => void;
}

const statuses: NodeStatus[] = ["not_started", "in_progress", "done"];

export function NodeSheet({ slug, node, onClose, onStatusChange }: NodeSheetProps) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={node !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "max-h-[75vh] overflow-y-auto rounded-t-xl" : "w-full sm:max-w-md"}
      >
        {node && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{node.title}</SheetTitle>
              {/* Plain text on purpose: summaries can come from the AI generator. */}
              <SheetDescription className="leading-6">{node.summary}</SheetDescription>
            </SheetHeader>

            <div className="mt-6 space-y-5">
              <div className="space-y-2">
                <label htmlFor="node-status" className="text-sm font-medium text-foreground">
                  Your status
                </label>
                <Select
                  value={node.status}
                  onValueChange={(value) => onStatusChange(node.id, value as NodeStatus)}
                >
                  <SelectTrigger id="node-status" className="w-full">
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

              {(node.has_exercise || node.linked_paper_id) && (
                <div className="flex flex-wrap gap-2">
                  {node.has_exercise && (
                    <Badge variant="secondary" className="gap-1">
                      <Code2 className="size-3" aria-hidden="true" />
                      Has exercise
                    </Badge>
                  )}
                  {node.linked_paper_id && (
                    <Badge variant="secondary" className="gap-1">
                      <FileText className="size-3" aria-hidden="true" />
                      Linked paper
                    </Badge>
                  )}
                </div>
              )}

              <Button asChild className="w-full">
                <Link to="/roadmaps/$slug/$nodeId" params={{ slug, nodeId: node.id }}>
                  Open topic <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
