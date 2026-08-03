import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getMemoryManager } from "@/core/ai/memory";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"memory"` Merge Field domain (Step 4) — the single most recent
 * **approved** AI Memory entry about the linked Client (falling back to
 * the linked Event when no Client is set), never a `"proposed"` one — an
 * unreviewed AI suggestion must never silently appear inside a generated
 * Document's own text.
 */
export const memoryMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "recent_memory_summary", label: "Recent Memory", description: "The most recent approved AI Memory entry about the linked Client or Event.", domain: "memory", valueType: "string", required: false },
];

export function registerMemoryMergeFields(): void {
  for (const definition of memoryMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("recent_memory_summary", async (context) => {
    const entityType = context.clientId ? "client" : context.eventId ? "event" : null;
    const entityId = context.clientId ?? context.eventId;
    if (!entityType || !entityId) return null;

    const entries = await getMemoryManager().filterMemories(context.workspaceId, { entityType, entityId, approvalStatus: "approved" });
    if (entries.length === 0) return null;

    const mostRecent = entries.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return mostRecent.summary;
  });
}
