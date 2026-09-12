/**
 * SOCIAL-06B — Inspiration & Reference Library data foundation. Schema
 * only this checkpoint: no repository, no Server Action, no UI
 * (SOCIAL-06C+ own those). See the migration's own comment
 * (`20260919100000_inspiration_items_foundation.sql`) for the full
 * reasoning behind every field's presence or deliberate absence.
 *
 * Deliberately carries no field that could hold a copy of the source's
 * own wording (no `platform_caption`/`full_caption`/`transcript`/
 * `original_text`/`source_text`/`verbatim_content`) — only the founder's
 * own structural observations (`hook`, `cta`, `why_it_works`, `notes`).
 * `archived_at` is the entire lifecycle model — no `status`/`is_archived`/
 * `used_at`.
 */

export const INSPIRATION_SOURCE_TYPES = ["instagram", "tiktok", "youtube", "pinterest", "website", "manual", "other"] as const;
export type InspirationSourceType = (typeof INSPIRATION_SOURCE_TYPES)[number];

export const INSPIRATION_CONTENT_FORMATS = ["reel", "carousel", "story", "static", "video", "other"] as const;
export type InspirationContentFormat = (typeof INSPIRATION_CONTENT_FORMATS)[number];

export interface InspirationItem {
  id: string;
  workspace_id: string;
  title: string;
  source_type: InspirationSourceType;
  /** The founder-pasted URL, exactly as entered. Null for a manual (URL-less) reference. */
  source_url: string | null;
  /** Derived from `source_url` at write time by the pure normalization utility — the real duplicate-detection key. Null exactly when `source_url` is null; never trusted as caller-supplied. */
  normalized_source_url: string | null;
  creator_name: string | null;
  creator_handle: string | null;
  platform_content_id: string | null;
  content_format: InspirationContentFormat | null;
  hook: string | null;
  cta: string | null;
  why_it_works: string | null;
  notes: string | null;
  duration_seconds: number | null;
  published_at: string | null;
  /** Optional reference to an existing, BloomOS-owned MediaAsset — never a duplicated upload. Cross-workspace ownership must be re-verified at the repository/action layer (SOCIAL-06C); this FK alone does not prove it. */
  media_asset_id: string | null;
  /** The only lifecycle state — an Inspiration row is never physically deleted. */
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
