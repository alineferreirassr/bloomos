import { getMemoryManager } from "@/core/ai/memory/manager";
import type { AIMemoryEntry } from "@/types/aiMemory";

const PREFERENCE_TAG = "copilot-preference";
const FAVORITE_PROMPT_TAG = "favorite-prompt";

/**
 * Checkpoint 20, Step 17 — Bloom AI remembers a small, closed set of
 * stylistic preferences, never anything sensitive (no payment details, no
 * credentials, no client PII) — reuses the existing Memory Manager
 * (`core/ai/memory/manager.ts`) rather than a bespoke new store, tagged
 * `copilot-preference` and scoped `visibility: "user"` so one member's
 * writing tone never leaks into another's. `category: "workspace_knowledge"`
 * is the exact category that store's own doc comment names for "preferences,
 * policies a human recorded."
 */
export const COPILOT_PREFERENCE_KEYS = [
  "preferred_proposal_style",
  "favorite_vendors",
  "preferred_flower_style",
  "writing_tone",
  "greeting_style",
  "favorite_hotel",
] as const;
export type CopilotPreferenceKey = (typeof COPILOT_PREFERENCE_KEYS)[number];

export const COPILOT_PREFERENCE_LABELS: Record<CopilotPreferenceKey, string> = {
  preferred_proposal_style: "Preferred Proposal Style",
  favorite_vendors: "Favorite Vendors",
  preferred_flower_style: "Preferred Flower Style",
  writing_tone: "Writing Tone",
  greeting_style: "Greeting Style",
  favorite_hotel: "Favorite Hotel",
};

export async function saveCopilotPreference(workspaceId: string, userId: string, key: CopilotPreferenceKey, value: string) {
  return getMemoryManager().createMemory(workspaceId, {
    skillId: null,
    title: key,
    summary: value,
    category: "workspace_knowledge",
    importance: "low",
    visibility: "user",
    userId,
    tags: [PREFERENCE_TAG, key],
    confidence: 100,
    source: "human",
    approvalStatus: "approved",
  });
}

export async function listCopilotPreferences(workspaceId: string, userId: string): Promise<AIMemoryEntry[]> {
  const entries = await getMemoryManager().filterMemories(workspaceId, { tags: [PREFERENCE_TAG], userId, visibility: "user" });
  // Most-recent write per key wins — a preference is edited in place conceptually, even though the underlying store is append-only.
  const byKey = new Map<string, AIMemoryEntry>();
  for (const entry of entries) byKey.set(entry.title, entry);
  return [...byKey.values()];
}

/** Step 15's own "Users can save favorites" — same Memory Manager, a different tag, `title` holds the prompt id and `summary` holds its display title so a favorites list never needs a second lookup. */
export async function toggleFavoritePrompt(workspaceId: string, userId: string, promptId: string, promptTitle: string, favorite: boolean) {
  if (!favorite) return { success: true } as const;
  return getMemoryManager().createMemory(workspaceId, {
    skillId: null,
    title: promptId,
    summary: promptTitle,
    category: "workspace_knowledge",
    importance: "low",
    visibility: "user",
    userId,
    tags: [FAVORITE_PROMPT_TAG],
    confidence: 100,
    source: "human",
    approvalStatus: "approved",
  });
}

export async function listFavoritePromptIds(workspaceId: string, userId: string): Promise<string[]> {
  const entries = await getMemoryManager().filterMemories(workspaceId, { tags: [FAVORITE_PROMPT_TAG], userId, visibility: "user" });
  return [...new Set(entries.map((entry) => entry.title))];
}
