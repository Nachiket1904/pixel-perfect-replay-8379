// React Query hooks. They only call functions from api.ts, so swapping the mock
// layer for real fetch calls later does not touch any component.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  generateRoadmap,
  getDashboard,
  getGenerationQuota,
  getImplementation,
  getNode,
  getPaper,
  getRoadmap,
  listRoadmaps,
  searchPapers,
  updateNodeStatus,
} from "@/lib/api";
import type {
  GenerateRoadmapRequest,
  NodeDetail,
  NodeStatus,
  PaperSearchParams,
  Roadmap,
} from "@/lib/types";

export type RoadmapFilter = "all" | "official" | "mine";

export const queryKeys = {
  roadmaps: (filter: RoadmapFilter) => ["roadmaps", filter] as const,
  roadmap: (slug: string) => ["roadmap", slug] as const,
  quota: ["generation-quota"] as const,
  node: (slug: string, nodeId: string) => ["node", slug, nodeId] as const,
  dashboard: ["dashboard"] as const,
  paperSearch: (params: PaperSearchParams) => ["papers", "search", params] as const,
  paper: (id: string) => ["paper", id] as const,
  implementation: (id: string) => ["implementation", id] as const,
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

/**
 * Optimistic status update: the roadmap and node caches change instantly and roll back
 * on error. Works from both the roadmap page and the topic page.
 */
export function useUpdateNodeStatus(roadmap: { id: string; slug: string }) {
  const queryClient = useQueryClient();
  const roadmapKey = queryKeys.roadmap(roadmap.slug);

  return useMutation({
    mutationFn: ({ nodeId, status }: StatusChange) => updateNodeStatus(roadmap.id, nodeId, status),
    onMutate: async ({ nodeId, status }: StatusChange) => {
      const nodeKey = queryKeys.node(roadmap.slug, nodeId);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: roadmapKey }),
        queryClient.cancelQueries({ queryKey: nodeKey }),
      ]);
      const previousRoadmap = queryClient.getQueryData<Roadmap>(roadmapKey);
      const previousNode = queryClient.getQueryData<NodeDetail>(nodeKey);
      if (previousRoadmap) {
        queryClient.setQueryData<Roadmap>(roadmapKey, {
          ...previousRoadmap,
          nodes: previousRoadmap.nodes.map((n) => (n.id === nodeId ? { ...n, status } : n)),
        });
      }
      if (previousNode) queryClient.setQueryData<NodeDetail>(nodeKey, { ...previousNode, status });
      return { previousRoadmap, previousNode, nodeKey };
    },
    onError: (_error, _vars, context) => {
      if (!context) return;
      if (context.previousRoadmap) queryClient.setQueryData(roadmapKey, context.previousRoadmap);
      if (context.previousNode) queryClient.setQueryData(context.nodeKey, context.previousNode);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      // Neighbour topics show prerequisite status, so refresh all topic pages of this roadmap.
      void queryClient.invalidateQueries({ queryKey: ["node", roadmap.slug] });
    },
  });
}

export function useNode(slug: string, nodeId: string) {
  return useQuery({
    queryKey: queryKeys.node(slug, nodeId),
    queryFn: () => getNode(slug, nodeId),
    retry: false,
  });
}

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboard });
}

export function usePaperSearch(params: PaperSearchParams) {
  return useQuery({
    queryKey: queryKeys.paperSearch(params),
    queryFn: () => searchPapers(params),
    // Keep showing old results while the next search loads (no flicker while typing).
    placeholderData: (previous) => previous,
  });
}

export function usePaper(id: string) {
  return useQuery({ queryKey: queryKeys.paper(id), queryFn: () => getPaper(id), retry: false });
}

export function useImplementation(id: string) {
  return useQuery({
    queryKey: queryKeys.implementation(id),
    queryFn: () => getImplementation(id),
    retry: false,
  });
}
