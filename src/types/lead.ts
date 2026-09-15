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
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/**
 * SOCIAL-13C-FND — foundation only, not yet used by any write path. The
 * narrow shape a future Instagram Lead-capture Automation Action (SOCIAL-13C
 * itself, still unauthorized as of this checkpoint) would need to represent
 * a Lead captured from an Instagram comment or DM, without inventing data
 * this codebase has no honest way to obtain: `first_name`/`last_name`/`email`
 * are explicitly nullable here (never a placeholder string), matching the
 * now-nullable `Lead` columns above. `instagram_external_id` is required
 * (this is exactly what makes a social capture "social" — it's the one
 * stable identifier every Instagram comment/DM event always carries);
 * `instagram` (the username) and `message` (the comment/DM text) are
 * optional, matching their own real-world availability. No repository
 * function accepts this type yet — see this checkpoint's own final report
 * for why creating one now would be premature.
 */
export interface InstagramLeadCaptureInput {
  workspaceId: string;
  source: "Instagram";
  instagramExternalId: string;
  instagram: string | null;
  message: string | null;
  firstName: null;
  lastName: null;
  email: null;
}
