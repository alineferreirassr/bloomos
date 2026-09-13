/**
 * SOCIAL-07B — Ideas data foundation. Schema only this checkpoint: no
 * repository, no Server Action, no UI (SOCIAL-07C+ own those). See the
 * migration's own comment (`20260920100000_idea_items_foundation.sql`) and
 * SOCIAL-07A's own read-only architecture audit for the full reasoning
 * behind every field's presence or deliberate absence.
 *
 * An Idea is an original Amoré Bloom content concept — something that does
 * not yet exist. It may optionally cite an Inspiration reference
 * (`source_inspiration_id`) as its trigger, but it is never a copy or
 * transformation of one. `status` plus `archived_at` is the entire
 * lifecycle model — no backlog/ready/in_progress/converted state.
 */

import type { InspirationContentFormat } from "@/types/inspirationItem";

export const IDEA_STATUSES = ["active", "archived"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const IDEA_PRIORITIES = ["low", "normal", "high"] as const;
export type IdeaPriority = (typeof IDEA_PRIORITIES)[number];

export interface IdeaItem {
  id: string;
  workspace_id: string;
  title: string;
  /** The actual concept — Amoré Bloom's own not-yet-created output. */
  description: string;
  status: IdeaStatus;
  /** Optional reference to the Inspiration that triggered this Idea. Never a copy of its content — cross-workspace ownership must be re-verified at the repository/action layer (SOCIAL-07C); this FK alone does not prove it. */
  source_inspiration_id: string | null;
  content_format: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  audience: string | null;
  notes: string | null;
  /** Optional reference to an existing, BloomOS-owned MediaAsset — never a duplicated upload. Cross-workspace ownership must be re-verified at the repository/action layer (SOCIAL-07C); this FK alone does not prove it. */
  media_asset_id: string | null;
  priority: IdeaPriority | null;
  /** The archive timestamp — an Idea row is never physically deleted. */
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
