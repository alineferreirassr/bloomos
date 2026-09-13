import type { IdeaPriority } from "@/types/ideaItem";

/**
 * SOCIAL-07D — plain text/Badge labels, matching `INSPIRATION_CONTENT_FORMAT_LABELS`'s
 * own established convention for a small fixed enum. `content_format`
 * itself has no Idea-specific label map — it reuses
 * `INSPIRATION_CONTENT_FORMAT_LABELS` verbatim (SOCIAL-07A/07B's own
 * decision to share the exact same vocabulary, not a second incompatible
 * enum).
 */
export const IDEA_PRIORITY_LABELS: Record<IdeaPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
};
