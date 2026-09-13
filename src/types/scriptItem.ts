/**
 * SOCIAL-08B — Script Studio data foundation. Schema only this checkpoint:
 * no repository, no Server Action, no UI (SOCIAL-08C+ own those). See the
 * migration's own comment (`20260921100000_script_items_foundation.sql`)
 * and SOCIAL-08A's own read-only architecture audit for the full reasoning
 * behind every field's presence or deliberate absence.
 *
 * A Script is the parent record for one script project, optionally
 * triggered by an Idea (`source_idea_id`) but never a copy of one. `status`
 * plus `archived_at` is the entire lifecycle model — no destructive
 * delete. Actual script content lives in `ScriptVersion`/`ScriptBlock`,
 * not here.
 */

export const SCRIPT_STATUSES = ["active", "archived"] as const;
export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

export interface ScriptItem {
  id: string;
  workspace_id: string;
  title: string;
  status: ScriptStatus;
  /** Optional reference to the Idea that triggered this Script. Never a copy of its content — cross-workspace ownership must be re-verified at the repository/action layer (SOCIAL-08C); this FK alone does not prove it. */
  source_idea_id: string | null;
  /** The archive timestamp — a Script row is never physically deleted. */
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
