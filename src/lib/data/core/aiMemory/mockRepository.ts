import type { AIMemoryEntry, AIMemoryProposal, CreateAIMemoryInput, UpdateAIMemoryInput, AIMemoryFilter } from "@/types/aiMemory";
import type { AIMemoryRepository } from "@/lib/data/core/aiMemory/repository";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso, delay } from "@/lib/data/utils";

let entries: AIMemoryEntry[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetAIMemoryStore(): void {
  entries = [];
}

function isTerminal(status: AIMemoryEntry["approval_status"]): boolean {
  return status === "rejected" || status === "archived" || status === "expired";
}

async function createMemory(workspaceId: string, input: CreateAIMemoryInput): Promise<DataResult<AIMemoryEntry>> {
  const title = input.title.trim();
  const summary = input.summary.trim();
  if (title.length === 0) return fail("Please fix the highlighted fields.", { title: "Title is required" });
  if (summary.length === 0) return fail("Please fix the highlighted fields.", { summary: "Summary is required" });
  if (input.visibility === "user" && !input.userId) {
    return fail("Please fix the highlighted fields.", { userId: "A user-visible memory needs a user id" });
  }
  if (input.confidence < 0 || input.confidence > 100) {
    return fail("Please fix the highlighted fields.", { confidence: "Confidence must be between 0 and 100" });
  }

  const now = nowIso();
  const entry: AIMemoryEntry = {
    id: generateId("ai_memory"),
    workspace_id: workspaceId,
    skill_id: input.skillId,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    title,
    summary,
    category: input.category,
    importance: input.importance,
    visibility: input.visibility,
    user_id: input.visibility === "user" ? (input.userId ?? null) : null,
    tags: input.tags ?? [],
    confidence: input.confidence,
    source: input.source,
    approval_status: input.approvalStatus ?? "proposed",
    reviewed_by: null,
    reviewed_at: null,
    created_at: now,
    updated_at: now,
    expires_at: input.expiresAt ?? null,
  };
  entries = [...entries, entry];
  return ok(entry);
}

async function proposeMemory(workspaceId: string, proposal: AIMemoryProposal): Promise<DataResult<AIMemoryEntry>> {
  return createMemory(workspaceId, {
    skillId: proposal.skillId,
    entityType: proposal.entityType,
    entityId: proposal.entityId,
    title: proposal.title,
    summary: proposal.summary,
    category: proposal.category ?? "ai_generated_knowledge",
    importance: "medium",
    visibility: proposal.visibility,
    userId: proposal.userId,
    tags: proposal.tags,
    confidence: proposal.confidence ?? 70,
    source: "skill",
    approvalStatus: "proposed",
  });
}

async function updateMemory(id: string, input: UpdateAIMemoryInput): Promise<DataResult<AIMemoryEntry>> {
  const existing = entries.find((entry) => entry.id === id);
  if (!existing) return fail("Memory not found.");
  if (input.title !== undefined && input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title is required" });
  }
  const updated: AIMemoryEntry = {
    ...existing,
    title: input.title?.trim() ?? existing.title,
    summary: input.summary?.trim() ?? existing.summary,
    importance: input.importance ?? existing.importance,
    tags: input.tags ?? existing.tags,
    expires_at: input.expiresAt !== undefined ? input.expiresAt : existing.expires_at,
    updated_at: nowIso(),
  };
  entries = entries.map((entry) => (entry.id === id ? updated : entry));
  return ok(updated);
}

async function archiveMemory(id: string): Promise<DataResult<AIMemoryEntry>> {
  const existing = entries.find((entry) => entry.id === id);
  if (!existing) return fail("Memory not found.");
  const updated: AIMemoryEntry = { ...existing, approval_status: "archived", updated_at: nowIso() };
  entries = entries.map((entry) => (entry.id === id ? updated : entry));
  return ok(updated);
}

async function expireMemories(workspaceId: string, now: string): Promise<number> {
  let count = 0;
  entries = entries.map((entry) => {
    if (entry.workspace_id !== workspaceId) return entry;
    if (isTerminal(entry.approval_status)) return entry;
    if (!entry.expires_at || entry.expires_at > now) return entry;
    count += 1;
    return { ...entry, approval_status: "expired", updated_at: now };
  });
  return count;
}

async function getMemoryById(id: string): Promise<AIMemoryEntry | null> {
  await delay(50);
  return entries.find((entry) => entry.id === id) ?? null;
}

async function filterMemories(workspaceId: string, filter: AIMemoryFilter): Promise<AIMemoryEntry[]> {
  await delay(100);
  return entries
    .filter((entry) => entry.workspace_id === workspaceId)
    .filter((entry) => filter.category === undefined || entry.category === filter.category)
    .filter((entry) => filter.entityType === undefined || entry.entity_type === filter.entityType)
    .filter((entry) => filter.entityId === undefined || entry.entity_id === filter.entityId)
    .filter((entry) => filter.skillId === undefined || entry.skill_id === filter.skillId)
    .filter((entry) => filter.importance === undefined || entry.importance === filter.importance)
    .filter((entry) => filter.tags === undefined || filter.tags.length === 0 || entry.tags.some((tag) => filter.tags?.includes(tag)))
    .filter((entry) => filter.approvalStatus === undefined || entry.approval_status === filter.approvalStatus)
    .filter((entry) => filter.visibility === undefined || entry.visibility === filter.visibility)
    .filter((entry) => filter.userId === undefined || entry.user_id === filter.userId)
    .filter((entry) => filter.includeExpired || entry.approval_status !== "expired")
    .filter((entry) => filter.includeArchived || entry.approval_status !== "archived")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function approveMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>> {
  const existing = entries.find((entry) => entry.id === id);
  if (!existing) return fail("Memory proposal not found.");
  const updated: AIMemoryEntry = { ...existing, approval_status: "approved", reviewed_by: reviewerId, reviewed_at: nowIso(), updated_at: nowIso() };
  entries = entries.map((entry) => (entry.id === id ? updated : entry));
  return ok(updated);
}

async function rejectMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>> {
  const existing = entries.find((entry) => entry.id === id);
  if (!existing) return fail("Memory proposal not found.");
  const updated: AIMemoryEntry = { ...existing, approval_status: "rejected", reviewed_by: reviewerId, reviewed_at: nowIso(), updated_at: nowIso() };
  entries = entries.map((entry) => (entry.id === id ? updated : entry));
  return ok(updated);
}

async function getPendingProposals(workspaceId: string): Promise<AIMemoryEntry[]> {
  await delay(100);
  return entries
    .filter((entry) => entry.workspace_id === workspaceId && entry.approval_status === "proposed")
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export const mockAIMemoryRepository: AIMemoryRepository = {
  createMemory,
  updateMemory,
  archiveMemory,
  expireMemories,
  getMemoryById,
  filterMemories,
  proposeMemory,
  approveMemory,
  rejectMemory,
  getPendingProposals,
};
