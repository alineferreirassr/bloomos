import { getMemoryManager } from "@/core/ai/memory/manager";
import type { AIMemoryCategory, AIMemoryEntry, AIMemoryFilter } from "@/types/aiMemory";
import type { AIContextBuilder } from "@/core/ai/context/types";

export interface MemoryContextData {
  memories: AIMemoryEntry[];
}

/**
 * Checkpoint 6, Step 6 — the one Context Orchestrator section every Skill
 * may *optionally* request (`SkillDefinition.optionalContext`), never a
 * dependency the platform imposes. Only ever returns `"approved"` memories
 * — a still-`"proposed"` suggestion hasn't been vetted by a human yet and
 * must never silently feed back into a future generation.
 *
 * Scoping is entirely `refs`-driven, the same loose id/value bag every
 * other builder already reads from: `refs.eventId`/`refs.clientId` (when
 * present) scope to memories about that one entity — the natural case for
 * a per-Event or per-Client Skill; `refs.memorySkillId`/`refs.memoryCategory`
 * (set by the calling Skill's own `execute`, not a generic caller) let a
 * workspace-wide Skill like the Daily Operations Brief ask specifically for
 * its own prior historical snapshots rather than every entity's memory.
 * Returns `null` (never an empty-but-present section) when nothing matches
 * — a Skill consuming this should treat "no memory yet" exactly like "this
 * Workspace has no history," not an error.
 */
export const memoryContextBuilder: AIContextBuilder = {
  key: "memory",
  priority: 9,
  async build({ workspaceId, refs }) {
    const filter: AIMemoryFilter = { approvalStatus: "approved" };
    if (refs.memorySkillId) filter.skillId = refs.memorySkillId;
    if (refs.memoryCategory) filter.category = refs.memoryCategory as AIMemoryCategory;
    if (refs.eventId) {
      filter.entityType = "event";
      filter.entityId = refs.eventId;
    } else if (refs.clientId) {
      filter.entityType = "client";
      filter.entityId = refs.clientId;
    }

    const memories = await getMemoryManager().filterMemories(workspaceId, filter);
    if (memories.length === 0) return null;
    return { data: { memories }, source: "getMemoryManager().filterMemories" };
  },
};
