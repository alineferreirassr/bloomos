/**
 * SOCIAL-08B — one draft-or-published version of a Script's content,
 * mirroring `service_versions`' own immutable-snapshot lifecycle (the
 * versioning precedent selected in SOCIAL-08A's audit). `version_number`/
 * `published_at`/`published_by` are null on every draft row and stamped
 * together only at publish time. Ordered content lives in `ScriptBlock`,
 * scoped to `script_version_id`, never `script_id` directly.
 */

export const SCRIPT_VERSION_STATUSES = ["draft", "published"] as const;
export type ScriptVersionStatus = (typeof SCRIPT_VERSION_STATUSES)[number];

export interface ScriptVersion {
  id: string;
  script_id: string;
  workspace_id: string;
  status: ScriptVersionStatus;
  /** Null on every draft — no release identity yet. Stamped, permanently, only at publish time. */
  version_number: number | null;
  published_at: string | null;
  published_by: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
