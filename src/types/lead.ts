import type { LeadStatus } from "@/core/enums/leadStatus";

/**
 * Field names mirror docs/database.md and the approved Leads spec verbatim
 * (snake_case) rather than being translated to camelCase — there's no
 * Supabase mapping layer yet, so a translation layer would be pure overhead.
 */
export interface Lead {
  id: string;
  workspace_id: string;
  /**
   * SOCIAL-13C-FND — nullable, not `string`: a manually-entered Lead (the
   * only write path that exists today, gated by `leadFormSchema`'s own
   * `.min(1)`) always has one, but the data model itself no longer
   * requires it, so a future social-originated Lead (an Instagram
   * comment/DM, where Meta never exposes a real name) can be represented
   * honestly instead of forcing a fabricated value.
   */
  first_name: string | null;
  /** SOCIAL-13C-FND — nullable; see `first_name`'s own doc comment, same reasoning. */
  last_name: string | null;
  /** SOCIAL-13C-FND — nullable; see `first_name`'s own doc comment. Manual creation still requires a real, `.email()`-validated address — only a future social write path can ever leave this null. */
  email: string | null;
  phone: string | null;
  /** The user-editable Instagram username/handle — free text, never used for deduplication. Distinct from `instagram_external_id` below. */
  instagram: string | null;
  source: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  message: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  /** Not in the original required-fields list, but necessary to satisfy the
   *  conversion requirements (store the resulting client_id, prevent
   *  duplicate conversion). */
  converted_client_id: string | null;
  /**
   * SOCIAL-13C-FND — Meta's own stable, external Instagram-scoped id for
   * the comment author/DM participant this Lead originated from. Null for
   * every manually-created Lead (and for every Lead until a future
   * checkpoint's Automation Action actually writes one). Workspace-scoped
   * uniqueness only, enforced by a partial unique index
   * (`leads_workspace_instagram_external_id_idx`,
   * `20260928100000_leads_social_capture_foundation.sql`) — never a global
   * constraint. Never interchangeable with `instagram` (a mutable,
   * free-text username) — this field exists specifically because a
   * username is not a safe deduplication key.
   */
  instagram_external_id: string | null;
  /**
   * SOCIAL-15B — the Social Post this Lead originated from, when known
   * (resolved via the exact-id Post<->Comment join,
   * `core/social/resolveSocialPostForInstagramComment.ts` — never
   * inferred from timestamps/text/proximity). Data-foundation only this
   * checkpoint: always absent on a Lead constructed by a write path that
   * predates SOCIAL-15C (optional, not just nullable, so every existing
   * Lead-construction site — `instagramLeadCapture.ts`'s own
   * `newLeadFields()` included, deliberately untouched by SOCIAL-15B —
   * keeps compiling without needing to know about it), and always
   * present as `string | null` on a Lead actually read back from storage
   * (a DB row/mock-store object always has every column). No backfill —
   * every Lead that existed before this migration has this permanently
   * `null`, and SOCIAL-15C is the only future write path authorized to
   * ever set it.
   */
  social_post_id?: string | null;
  /** SOCIAL-15B — the Instagram comment this Lead originated from, when known (comment-triggered capture only). See `social_post_id`'s own doc comment for the full reasoning — same optionality, same no-backfill guarantee, same future-writer-only population. */
  instagram_comment_id?: string | null;
  /** SOCIAL-15B — the Instagram DM conversation this Lead originated from, when known (DM-triggered capture only). See `social_post_id`'s own doc comment for the full reasoning. */
  instagram_conversation_id?: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/**
 * SOCIAL-13C-FND — the narrow shape used by the Instagram Lead-capture
 * Automation Action (SOCIAL-13C, `core/automation/instagramLeadCapture.ts`)
 * to represent a Lead captured from an Instagram comment or DM, without
 * inventing data this codebase has no honest way to obtain:
 * `first_name`/`last_name`/`email` are explicitly nullable here (never a
 * placeholder string), matching the nullable `Lead` columns above.
 * `instagram_external_id` is required (this is exactly what makes a social
 * capture "social" — it's the one stable identifier every Instagram
 * comment/DM event always carries); `instagram` (the username) and
 * `message` (the comment/DM text) are optional, matching their own
 * real-world availability.
 *
 * SOCIAL-15C — three new, deliberately distinct, non-polymorphic
 * attribution fields (never a single "source ref" field): a Comment
 * capture can only ever populate `instagramCommentId`/`socialPostId`, a
 * DM capture can only ever populate `instagramConversationId` — mirroring
 * exactly `Lead`'s own three separate columns (SOCIAL-15B). Every one of
 * these is optional/nullable, since the underlying evidence is not always
 * available (e.g. a comment with no `external_media_id` yields a real
 * `instagramCommentId` but a `null` `socialPostId` — a legitimate partial
 * attribution, never backfilled or guessed). None of this changes
 * `instagramExternalId`'s own meaning — it stays the Meta identity of the
 * *person*, never repurposed as content attribution.
 */
export interface InstagramLeadCaptureInput {
  workspaceId: string;
  source: "Instagram";
  instagramExternalId: string;
  instagram: string | null;
  message: string | null;
  /** SOCIAL-15C — set only by a comment-triggered capture; always `null`/absent for a DM. */
  instagramCommentId?: string | null;
  /** SOCIAL-15C — the Social Post resolved from the comment's own `external_media_id` via `resolveSocialPostForInstagramComment()`; `null` whenever no exact-id match exists, never inferred. Always `null`/absent for a DM. */
  socialPostId?: string | null;
  /** SOCIAL-15C — set only by a DM-triggered capture; always `null`/absent for a comment. Never a Social Post reference — a DM is never attributed to a post by inference. */
  instagramConversationId?: string | null;
  firstName: null;
  lastName: null;
  email: null;
}
