import { z } from "zod";
import { registerSkill } from "@/core/ai/skills/registry";
import { getMemoryManager } from "@/core/ai/memory";
import type { SkillDefinition, SkillExecutionMetadata } from "@/core/ai/skills/types";
import type { AIMemoryCategory, AIMemoryEntry, AIMemoryImportance } from "@/types/aiMemory";

export const BROWSE_AI_MEMORY_SKILL_ID = "browse-ai-memory";
export const BROWSE_AI_MEMORY_VERSION = "browse-ai-memory-v1";
const RECENT_MEMORIES_LIMIT = 20;

export interface BrowseAIMemoryData {
  memories: AIMemoryEntry[];
}

/**
 * Checkpoint 6, Step 10 — the one new Skill this checkpoint adds (every
 * other Skill this checkpoint touches was already registered). Unlike
 * Proposal Generator / Event Operations Brief / Daily Operations Brief,
 * this Skill's own `execute` never calls the AI Runtime at all: "browse my
 * own structured memory" is a read against the Knowledge Store, not a
 * question for a model — building it on `runSkillCompletion` would mean
 * inventing a prompt and a provider call for a feature with nothing for
 * either to do, which is exactly the "no vector database, no semantic
 * search, no agents" non-goal this checkpoint's spec draws a line under.
 * It's still declared and discovered exactly like every other Skill (same
 * registry, same `executeSkill` gates for permission/role/feature-flag),
 * which is the actual point of Step 10's "through executeSkill()": one
 * front door, not a special case for this one.
 *
 * Visibility-aware by construction: a `"user"`-scoped memory is only ever
 * included for the member who ran this Skill (`params.userId`), never
 * every member's own private memories merged together — the Workspace's
 * own `"workspace"`-scoped memories are visible to everyone who can run
 * this Skill at all. No dedicated `memory.*` permission exists yet (the
 * Step 1 audit found none); `requiredPermissions: []`/`minimumRole: null`
 * reuses the Bloom AI Dashboard's own precedent that any active Workspace
 * member may view read-only AI activity — a future write path (approve/
 * reject a proposed memory) is exactly where a real permission would earn
 * its keep, not this read-only browse.
 */
const browseAIMemorySkill: SkillDefinition = {
  id: BROWSE_AI_MEMORY_SKILL_ID,
  name: "Browse AI Memory",
  description: "Lists this Workspace's own remembered operational history — approved proposals, Daily Brief snapshots, and reference knowledge — filterable by category and importance.",
  category: "operations",
  requiredPermissions: [],
  requiredContext: [],
  useCaseId: "browse-ai-memory",
  outputSchema: z.unknown(),
  supportedProviders: "any",
  requiredCapabilities: [],
  supportsStreaming: false,
  requiresApproval: false,
  requiresReview: false,
  commandPaletteVisible: true,
  sidebarVisible: true,
  featureFlag: null,
  minimumRole: null,
  version: BROWSE_AI_MEMORY_VERSION,
  estimatedLatencyMs: 200,
  contextFactsKey: "browseAIMemoryContext",
};

browseAIMemorySkill.execute = async (params) => {
  const startedAt = Date.now();
  const manager = getMemoryManager();

  const category = params.refs.memoryCategory as AIMemoryCategory | undefined;
  const importance = params.refs.memoryImportance as AIMemoryImportance | undefined;

  // `approvalStatus: "approved"` on both calls — a still-`"proposed"` memory
  // is a model's own unreviewed suggestion, not yet a fact this Workspace
  // has vetted (see `AIMemoryApprovalStatus`'s own doc comment); browsing
  // memory must never present one as though it were, the same rule
  // `memoryContextBuilder.ts` already applies for a Skill's own context read.
  const [workspaceMemories, userMemories] = await Promise.all([
    manager.filterMemories(params.workspaceId, { visibility: "workspace", category, importance, approvalStatus: "approved" }),
    manager.filterMemories(params.workspaceId, { visibility: "user", userId: params.userId, category, importance, approvalStatus: "approved" }),
  ]);

  const memories = [...workspaceMemories, ...userMemories]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, RECENT_MEMORIES_LIMIT);

  const metadata: SkillExecutionMetadata = {
    skillId: BROWSE_AI_MEMORY_SKILL_ID,
    useCaseId: browseAIMemorySkill.useCaseId,
    provider: "n/a",
    model: "n/a",
    promptVersion: BROWSE_AI_MEMORY_VERSION,
    mock: false,
    latencyMs: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  };

  return { success: true, data: { memories } satisfies BrowseAIMemoryData, context: null, metadata };
};

let registered = false;

export function registerBrowseAIMemorySkill(): void {
  if (registered) return;
  registerSkill(browseAIMemorySkill);
  registered = true;
}
