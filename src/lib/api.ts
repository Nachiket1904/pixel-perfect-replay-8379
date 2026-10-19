import { mockRoadmaps } from "@/lib/mock-data";
import {
  ApiError,
  type GenerateRoadmapRequest,
  type GenerationQuota,
  type Level,
  type NodeStatus,
  type Roadmap,
  type RoadmapSummary,
} from "@/lib/types";

const MOCK_DELAY_MS = 400;
const GENERATION_DELAY_MS = 2_500;
const QUOTA_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

let roadmaps = structuredClone(mockRoadmaps);
let remainingGenerations = QUOTA_LIMIT;
let quotaResetsAt = Date.now() + DAY_MS;

const delay = (milliseconds = MOCK_DELAY_MS) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function refreshQuotaIfExpired() {
  if (Date.now() >= quotaResetsAt) {
    remainingGenerations = QUOTA_LIMIT;
    quotaResetsAt = Date.now() + DAY_MS;
  }
}

function cloneRoadmap(roadmap: Roadmap): Roadmap {
  return structuredClone(roadmap);
}

function summarize(roadmap: Roadmap): RoadmapSummary {
  const done = roadmap.nodes.filter((item) => item.status === "done").length;
  return {
    id: roadmap.id,
    slug: roadmap.slug,
    title: roadmap.title,
    description: roadmap.description,
    source: roadmap.source,
    level: roadmap.level,
    node_count: roadmap.nodes.length,
    estimated_hours: roadmap.estimated_hours,
    progress: roadmap.progress ? { done, total: roadmap.nodes.length } : null,
  };
}

export async function listRoadmaps(
  filter: "all" | "official" | "mine" = "all",
): Promise<RoadmapSummary[]> {
  await delay();
  const filtered = roadmaps.filter((roadmap) => {
    if (filter === "official") return roadmap.source === "official";
    if (filter === "mine") return roadmap.source === "ai";
    return true;
  });
  return filtered.map(summarize);
}

export async function getRoadmap(slug: string): Promise<Roadmap> {
  await delay();
  const roadmap = roadmaps.find((item) => item.slug === slug);
  if (!roadmap) throw new ApiError("NOT_FOUND", `Roadmap “${slug}” was not found.`);
  return cloneRoadmap(roadmap);
}

export async function updateNodeStatus(
  roadmap_id: string,
  node_id: string,
  status: NodeStatus,
): Promise<void> {
  await delay();
  const roadmap = roadmaps.find((item) => item.id === roadmap_id);
  if (!roadmap) throw new ApiError("NOT_FOUND", `Roadmap “${roadmap_id}” was not found.`);
  const roadmapNode = roadmap.nodes.find((item) => item.id === node_id);
  if (!roadmapNode) throw new ApiError("NOT_FOUND", `Roadmap node “${node_id}” was not found.`);
  roadmapNode.status = status;
  if (roadmap.progress) {
    roadmap.progress = {
      done: roadmap.nodes.filter((item) => item.status === "done").length,
      total: roadmap.nodes.length,
    };
  }
}

export async function getGenerationQuota(): Promise<GenerationQuota> {
  await delay();
  refreshQuotaIfExpired();
  return { remaining: remainingGenerations, limit: QUOTA_LIMIT, resets_at: new Date(quotaResetsAt).toISOString() };
}

function goalTitle(goal: string): string {
  const trimmed = goal.trim().replace(/[.!?]+$/, "");
  const words = trimmed.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 56 ? `${words.slice(0, 53).trimEnd()}…` : words;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function generateRoadmap(req: GenerateRoadmapRequest): Promise<Roadmap> {
  await delay();
  refreshQuotaIfExpired();

  const goal = req.goal.trim();
  if (goal.length < 10) {
    throw new ApiError("VALIDATION_ERROR", "Tell us a little more about what you want to learn.");
  }
  if (/\b(cook|cricket|dance)\b/i.test(goal)) {
    throw new ApiError("NON_TECH_GOAL", "For now, roadmap generation is for technology learning goals.");
  }
  if (remainingGenerations <= 0) {
    throw new ApiError("RATE_LIMITED", "You’ve used all your roadmap generations for now.");
  }

  await delay(GENERATION_DELAY_MS);
  remainingGenerations -= 1;

  const template = roadmaps.find((roadmap) => roadmap.slug === "llm-engineer-a1b2");
  if (!template) throw new ApiError("SERVER_ERROR", "The roadmap template is temporarily unavailable.");

  const id = `roadmap-ai-${Date.now().toString(36)}`;
  const baseSlug = slugify(goalTitle(goal)) || "learning-roadmap";
  const slug = `${baseSlug}-${id.slice(-5)}`;
  const level: Level = req.level;
  const created: Roadmap = {
    ...cloneRoadmap(template),
    id,
    slug,
    title: goalTitle(goal),
    description: `A learning path shaped around: ${goal}`,
    source: "ai",
    level,
    estimated_hours: Math.max(8, Math.round((template.estimated_hours * 3) / Math.max(1, req.hours_per_week))),
    progress: null,
    goal_prompt: goal,
    created_at: new Date().toISOString(),
    nodes: template.nodes.map((item, index) => ({ ...item, id: `${id}-node-${index + 1}`, status: "not_started" })),
    edges: template.edges.map((item, index) => ({
      ...item,
      id: `${id}-edge-${index + 1}`,
      from_node_id: `${id}-node-${template.nodes.findIndex((node) => node.id === item.from_node_id) + 1}`,
      to_node_id: `${id}-node-${template.nodes.findIndex((node) => node.id === item.to_node_id) + 1}`,
    })),
  };
  roadmaps.push(created);
  return cloneRoadmap(created);
}