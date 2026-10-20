// React Query hooks. They only call functions from api.ts, so swapping the mock
// layer for real fetch calls later does not touch any component.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateRoadmap,
  getGenerationQuota,
  getRoadmap,
  listRoadmaps,
  updateNodeStatus,
} from "@/lib/api";
import type { GenerateRoadmapRequest, NodeStatus, Roadmap } from "@/lib/types";

export type RoadmapFilter = "all" | "official" | "mine";

export const queryKeys = {
  roadmaps: (filter: RoadmapFilter) => ["roadmaps", filter] as const,
  roadmap: (slug: string) => ["roadmap", slug] as const,
  quota: ["generation-quota"] as const,
};

export function useRoadmaps(filter: RoadmapFilter) {
  return useQuery({ queryKey: queryKeys.roadmaps(filter), queryFn: () => listRoadmaps(filter) });
}

export function useRoadmap(slug: string) {
  return useQuery({
    queryKey: queryKeys.roadmap(slug),
    queryFn: () => getRoadmap(slug),
    retry: false,
  });
}

export function useGenerationQuota() {
  return useQuery({ queryKey: queryKeys.quota, queryFn: getGenerationQuota });
}

export function useGenerateRoadmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (req: GenerateRoadmapRequest) => generateRoadmap(req),
    onSuccess: (roadmap) => {
      queryClient.setQueryData(queryKeys.roadmap(roadmap.slug), roadmap);
      void queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
    },
    // Quota changes on success and on rate-limit errors, so always refresh it.
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.quota }),
  });
}

interface StatusChange {
  nodeId: string;
  status: NodeStatus;
}

/** Optimistic status update: the UI changes instantly and rolls back on error. */
export function useUpdateNodeStatus(roadmap: Roadmap) {
  const queryClient = useQueryClient();
  const key = queryKeys.roadmap(roadmap.slug);

  return useMutation({
    mutationFn: ({ nodeId, status }: StatusChange) => updateNodeStatus(roadmap.id, nodeId, status),
    onMutate: async ({ nodeId, status }: StatusChange) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Roadmap>(key);
      if (previous) {
        queryClient.setQueryData<Roadmap>(key, {
          ...previous,
          nodes: previous.nodes.map((n) => (n.id === nodeId ? { ...n, status } : n)),
        });
      }
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["roadmaps"] }),
  });
}
