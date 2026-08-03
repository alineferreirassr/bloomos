import type { AIMemoryApprovalStatus, AIMemoryImportance, AIMemorySource } from "@/types/aiMemory";

/**
 * Step 5's "Memory Policies" — one small, independently-testable pure
 * function per policy, rather than one large conditional. The Memory
 * Manager (`manager.ts`) is the only caller; nothing in a Skill or the
 * Knowledge Store calls these directly, so a policy can change without
 * touching either layer.
 */

/** "Never remember failed executions." Anything else (a human-authored entry, a system snapshot with no execution concept at all) has no status to check and is always allowed through. */
export function shouldRemember(skillExecutionStatus: "success" | "failure" | null): boolean {
  return skillExecutionStatus !== "failure";
}

/**
 * "Remember accepted proposals. Remember operational decisions. Remember
 * approved summaries." — none of these need a second human review pass
 * when the source is `"system"` (a deterministic snapshot with no model
 * judgment involved, e.g. Daily Brief's own historical record, or a
 * decision a human already made elsewhere and a Skill is only recording).
 * A `"skill"` (model) suggestion always starts `"proposed"` regardless —
 * the model suggests what's worth remembering, it never decides
 * (`PRODUCT_PRINCIPLES.md` #4). A `"human"`-sourced entry is already the
 * result of a person's own decision, so it's approved on arrival too.
 */
export function defaultApprovalStatusFor(source: AIMemorySource): AIMemoryApprovalStatus {
  return source === "skill" ? "proposed" : "approved";
}

/** "Expire low-value memories." Low-importance memories are reclaimed soonest; high-importance memories never auto-expire (`null`) — an explicit `archiveMemory` call is the only way to retire one. */
const EXPIRY_WINDOW_DAYS: Record<AIMemoryImportance, number | null> = {
  low: 30,
  medium: 90,
  high: null,
};

export function computeDefaultExpiresAt(importance: AIMemoryImportance, now: Date = new Date()): string | null {
  const days = EXPIRY_WINDOW_DAYS[importance];
  if (days === null) return null;
  const expires = new Date(now);
  expires.setDate(expires.getDate() + days);
  return expires.toISOString();
}
