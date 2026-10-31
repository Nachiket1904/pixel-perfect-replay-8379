import { Sparkles, BadgeCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { RoadmapSource } from "@/lib/types";

export function SourceBadge({ source }: { source: RoadmapSource }) {
  if (source === "official") {
    return (
      <Badge className="gap-1 bg-primary text-primary-foreground hover:bg-primary">
        <BadgeCheck className="size-3" aria-hidden="true" /> Official
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="gap-1 border-warning text-accent-foreground">
      <Sparkles className="size-3" aria-hidden="true" /> AI-generated
    </Badge>
  );
}
