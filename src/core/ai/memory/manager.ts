import { mockAIMemoryRepository } from "@/lib/data/core/aiMemory/mockRepository";
import type { AIMemoryRepository } from "@/lib/data/core/aiMemory/repository";
import { shouldRemember, defaultApprovalStatusFor, computeDefaultExpiresAt } from "@/core/ai/memory/policies";
import { getLogger } from "@/core/observability/logger";
import { fail, type DataResult } from "@/lib/data/result";
import {
  AI_MEMORY_CATEGORIES,
  type AIMemoryEntry,
  type AIMemoryProposal,
  type CreateAIMemoryInput,
  type UpdateAIMemoryInput,
  type AIMemoryFilter,
  type AIMemorySummary,
  type AIMemoryCategory,
  type AIMemoryImportance,
} from "@/types/aiMemory";

/** Only ever meaningful for a Skill-initiated write — a human-authored or otherwise execution-less entry has no status to gate on. */
export interface MemoryWriteOptions {
  skillExecutionStatus?: "success" | "failure";
}

/**
 * The Memory Manager — the one place every Skill (or the Bloom AI
 * Dashboard, or a future review UI) reads or writes shared operational
 * memory, sitting directly on the Knowledge Store (`lib/data/core/aiMemory/`).
 * Three responsibilities live here and nowhere else: applying Memory
 * Policies (`policies.ts`) to every write, logging safe, structural
 * observability fields only — **never** a memory's own `title`/`summary`
 * content, the same "safe fields only" rule `core/ai/skills/resolver.ts`
 * already established for prompts — and computing `summarizeMemories`,
 * which the Knowledge Store itself has no concept of. `createMemory`/
 * `proposeMemory`/`updateMemory`/`archiveMemory`/`expireStaleMemories`/
 * `lookupMemory`/`filterMemories`/`summarizeMemories` are Step 3's own
 * verbs, one function each.
 */
export function getMemoryManager(): AIMemoryManager {
  return memoryManager;
}

export interface AIMemoryManager {
  createMemory(workspaceId: string, input: CreateAIMemoryInput, options?: MemoryWriteOptions): Promise<DataResult<AIMemoryEntry>>;
  proposeMemory(workspaceId: string, proposal: AIMemoryProposal, options?: MemoryWriteOptions): Promise<DataResult<AIMemoryEntry>>;
  updateMemory(id: string, input: UpdateAIMemoryInput): Promise<DataResult<AIMemoryEntry>>;
  archiveMemory(id: string): Promise<DataResult<AIMemoryEntry>>;
  expireStaleMemories(workspaceId: string, now?: Date): Promise<number>;
  lookupMemory(id: string): Promise<AIMemoryEntry | null>;
  filterMemories(workspaceId: string, filter: AIMemoryFilter): Promise<AIMemoryEntry[]>;
  summarizeMemories(workspaceId: string): Promise<AIMemorySummary>;
  approveMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>>;
  rejectMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>>;
  getPendingProposals(workspaceId: string): Promise<AIMemoryEntry[]>;
}

function knowledgeStore(): AIMemoryRepository {
  return mockAIMemoryRepository;
}

async function createMemory(workspaceId: string, input: CreateAIMemoryInput, options: MemoryWriteOptions = {}): Promise<DataResult<AIMemoryEntry>> {
  if (!shouldRemember(options.skillExecutionStatus ?? null)) {
    getLogger().info("Memory write skipped — failed execution", { workspaceId, skillId: input.skillId, category: input.category });
    return fail("Nothing to remember from a failed execution.");
  }

  const enriched: CreateAIMemoryInput = {
    ...input,
    approvalStatus: input.approvalStatus ?? defaultApprovalStatusFor(input.source),
    expiresAt: input.expiresAt !== undefined ? input.expiresAt : computeDefaultExpiresAt(input.importance),
  };
  const result = await knowledgeStore().createMemory(workspaceId, enriched);
  if (result.success) {
    getLogger().info("Memory created", {
      workspaceId,
      memoryId: result.data.id,
      skillId: result.data.skill_id,
      category: result.data.category,
      importance: result.data.importance,
      approvalStatus: result.data.approval_status,
      source: result.data.source,
    });
  }
  return result;
}

async function proposeMemory(workspaceId: string, proposal: AIMemoryProposal, options: MemoryWriteOptions = {}): Promise<DataResult<AIMemoryEntry>> {
  if (!shouldRemember(options.skillExecutionStatus ?? null)) {
    getLogger().info("Memory write skipped — failed execution", { workspaceId, skillId: proposal.skillId });
    return fail("Nothing to remember from a failed execution.");
  }
  const result = await knowledgeStore().proposeMemory(workspaceId, proposal);
  if (result.success) {
    getLogger().info("Memory proposed", { workspaceId, memoryId: result.data.id, skillId: result.data.skill_id, category: result.data.category });
  }
  return result;
}

async function updateMemory(id: string, input: UpdateAIMemoryInput): Promise<DataResult<AIMemoryEntry>> {
  const result = await knowledgeStore().updateMemory(id, input);
  if (result.success) getLogger().info("Memory updated", { memoryId: id });
  return result;
}

async function archiveMemory(id: string): Promise<DataResult<AIMemoryEntry>> {
  const result = await knowledgeStore().archiveMemory(id);
  if (result.success) getLogger().info("Memory archived", { memoryId: id });
  return result;
}

async function expireStaleMemories(workspaceId: string, now: Date = new Date()): Promise<number> {
  const count = await knowledgeStore().expireMemories(workspaceId, now.toISOString());
  getLogger().info("Memory expiration run", { workspaceId, expiredCount: count });
  return count;
}

async function lookupMemory(id: string): Promise<AIMemoryEntry | null> {
  const startedAt = Date.now();
  const entry = await knowledgeStore().getMemoryById(id);
  getLogger().info("Memory lookup", { memoryId: id, found: entry !== null, latencyMs: Date.now() - startedAt });
  return entry;
}

async function filterMemories(workspaceId: string, filter: AIMemoryFilter): Promise<AIMemoryEntry[]> {
  const startedAt = Date.now();
  const results = await knowledgeStore().filterMemories(workspaceId, filter);
  getLogger().info("Memory filter", { workspaceId, resultCount: results.length, latencyMs: Date.now() - startedAt });
  return results;
}

async function summarizeMemories(workspaceId: string): Promise<AIMemorySummary> {
  const all = await knowledgeStore().filterMemories(workspaceId, { includeExpired: true, includeArchived: true });

  const byCategory = Object.fromEntries(AI_MEMORY_CATEGORIES.map((category) => [category, 0])) as Record<AIMemoryCategory, number>;
  const byImportance: Record<AIMemoryImportance, number> = { low: 0, medium: 0, high: 0 };
  let pendingCount = 0;
  let approvedCount = 0;
  let rejectedCount = 0;
  let archivedCount = 0;
  let expiredCount = 0;

  for (const entry of all) {
    byCategory[entry.category] += 1;
    byImportance[entry.importance] += 1;
    if (entry.approval_status === "proposed") pendingCount += 1;
    else if (entry.approval_status === "approved") approvedCount += 1;
    else if (entry.approval_status === "rejected") rejectedCount += 1;
    else if (entry.approval_status === "archived") archivedCount += 1;
    else if (entry.approval_status === "expired") expiredCount += 1;
  }

  return { totalCount: all.length, byCategory, byImportance, pendingCount, approvedCount, rejectedCount, archivedCount, expiredCount };
}

async function approveMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>> {
  const result = await knowledgeStore().approveMemory(id, reviewerId);
  if (result.success) getLogger().info("Memory approved", { memoryId: id });
  return result;
}

async function rejectMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>> {
  const result = await knowledgeStore().rejectMemory(id, reviewerId);
  if (result.success) getLogger().info("Memory rejected", { memoryId: id });
  return result;
}

async function getPendingProposals(workspaceId: string): Promise<AIMemoryEntry[]> {
  return knowledgeStore().getPendingProposals(workspaceId);
}

const memoryManager: AIMemoryManager = {
  createMemory,
  proposeMemory,
  updateMemory,
  archiveMemory,
  expireStaleMemories,
  lookupMemory,
  filterMemories,
  summarizeMemories,
  approveMemory,
  rejectMemory,
  getPendingProposals,
};
