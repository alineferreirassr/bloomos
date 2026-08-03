import { getMemoryManager } from "@/core/ai/memory/manager";
import type { AIMemoryEntry } from "@/types/aiMemory";

const ACTIVITY_TAG = "copilot-activity";

/**
 * Checkpoint 20, Step 16 — AI Activity History. Logs the two events this
 * checkpoint's own UI can genuinely produce (a Suggestion accepted via
 * "Run", a Suggestion dismissed) through the same Memory Manager every
 * other Copilot preference already uses — see `copilotPreferences.ts`'s
 * own doc comment for why a bespoke new store wasn't built instead. Prompts
 * run through the Writing Studio and Skills executed through
 * `executeSkill()` already have their own persistence (Daily Brief
 * execution history, the Automation History store) — unifying every one of
 * those into a single cross-store search view was out of scope for this
 * checkpoint's own timebox; see Known Limitations in the checkpoint docs.
 */
export const COPILOT_ACTIVITY_KINDS = ["suggestion_accepted", "suggestion_ignored"] as const;
export type CopilotActivityKind = (typeof COPILOT_ACTIVITY_KINDS)[number];

export async function logCopilotActivity(workspaceId: string, userId: string, kind: CopilotActivityKind, label: string) {
  return getMemoryManager().createMemory(workspaceId, {
    skillId: null,
    title: kind,
    summary: label,
    category: "workspace_knowledge",
    importance: "low",
    visibility: "user",
    userId,
    tags: [ACTIVITY_TAG, kind],
    confidence: 100,
    source: "human",
    approvalStatus: "approved",
  });
}

export async function listCopilotActivity(workspaceId: string, userId: string): Promise<AIMemoryEntry[]> {
  const entries = await getMemoryManager().filterMemories(workspaceId, { tags: [ACTIVITY_TAG], userId, visibility: "user" });
  return entries.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}
