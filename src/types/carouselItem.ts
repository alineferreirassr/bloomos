/**
 * SOCIAL-10C — Carousel Studio data foundation. Schema only this
 * checkpoint: no Server Action, no UI (SOCIAL-10D/10E own those). See the
 * migration's own comment (`20260924100000_carousel_items_foundation.sql`)
 * and SOCIAL-10A's/SOCIAL-10B's own read-only audit and architecture
 * decision for the full reasoning behind every field's presence or
 * deliberate absence.
 *
 * A Carousel is the parent record for one carousel project, optionally
 * triggered by an Idea (`source_idea_id`) but never a copy of one, and
 * with no Script or Inspiration relationship at all (SOCIAL-10B). `status`
 * plus `archived_at` is the entire lifecycle model — no destructive
 * delete, no versioning. Actual slide content lives in `CarouselSlide`,
 * not here.
 */

export const CAROUSEL_STATUSES = ["active", "archived"] as const;
export type CarouselStatus = (typeof CAROUSEL_STATUSES)[number];

export interface CarouselItem {
  id: string;
  workspace_id: string;
  title: string;
  status: CarouselStatus;
  /** Optional reference to the Idea that triggered this Carousel. Never a copy of its content, never synced — cross-workspace ownership must be re-verified at the repository/action layer (SOCIAL-10D); this FK alone does not prove it. */
  source_idea_id: string | null;
  /** The archive timestamp — a Carousel row is never physically deleted. */
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
