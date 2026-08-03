import type { AIMemoryEntry, AIMemoryProposal, CreateAIMemoryInput, UpdateAIMemoryInput, AIMemoryFilter } from "@/types/aiMemory";
import type { DataResult } from "@/lib/data/result";

/**
 * The Knowledge Store — persistence only, no policy or observability logic
 * (that lives one layer up, in the Memory Manager — `core/ai/memory/manager.ts`).
 * Deliberately no hard delete: `archiveMemory`/`expireMemories` are the only
 * ways a memory stops being active, matching the Audit Log's own
 * "immutable record" precedent (`core/audit/repository.ts`) — a memory a
 * Skill once relied on should still be inspectable later, not silently
 * gone. `proposeMemory` is preserved unchanged from the pre-Checkpoint-6
 * propose/approve/reject workflow — Bloom AI is still never allowed to
 * silently persist a fact; only a human reviewer's explicit `approveMemory`
 * call makes a Skill-suggested memory eligible for `filterMemories` to
 * return by default.
 */
export interface AIMemoryRepository {
  createMemory(workspaceId: string, input: CreateAIMemoryInput): Promise<DataResult<AIMemoryEntry>>;
  updateMemory(id: string, input: UpdateAIMemoryInput): Promise<DataResult<AIMemoryEntry>>;
  archiveMemory(id: string): Promise<DataResult<AIMemoryEntry>>;
  /** Marks every non-terminal (`"proposed"`/`"approved"`) memory whose `expires_at` is at/before `now` as `"expired"`. Returns how many were changed. */
  expireMemories(workspaceId: string, now: string): Promise<number>;
  getMemoryById(id: string): Promise<AIMemoryEntry | null>;
  /** The one general-purpose read path — every other read (pending proposals, approved-for-scope, Dashboard summaries) is a `filterMemories` call with a specific filter. */
  filterMemories(workspaceId: string, filter: AIMemoryFilter): Promise<AIMemoryEntry[]>;

  proposeMemory(workspaceId: string, proposal: AIMemoryProposal): Promise<DataResult<AIMemoryEntry>>;
  approveMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>>;
  rejectMemory(id: string, reviewerId: string): Promise<DataResult<AIMemoryEntry>>;
  getPendingProposals(workspaceId: string): Promise<AIMemoryEntry[]>;
}
