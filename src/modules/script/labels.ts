import type { ScriptVersionStatus } from "@/types/scriptVersion";

/**
 * SOCIAL-08D — plain text/Badge labels, matching `IDEA_PRIORITY_LABELS`'s
 * own established convention for a small fixed enum. Script's own
 * `status` (active/archived) reuses the same "Archived" badge convention
 * every other archive-capable domain uses inline — no dedicated label map
 * needed for a two-value active/archived enum with no third rendered
 * state.
 */
export const SCRIPT_VERSION_STATUS_LABELS: Record<ScriptVersionStatus, string> = {
  draft: "Draft",
  published: "Published",
};
