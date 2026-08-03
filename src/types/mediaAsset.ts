import type { EntityType } from "@/core/enums/entityType";
import type { MediaAssetStatus } from "@/core/enums/mediaAssetStatus";

/**
 * v2.0 Checkpoint 25 — every field below is additive; a `MediaAsset` row
 * from any prior checkpoint reads with `folder_id: null`, `tags: []`,
 * `color_label: null`, `priority: null`, `ai_ready: false`,
 * `status: "pending"`, `approved_by/approved_at: null`, `version_notes: null`,
 * and `metadata` defaulted to all-null/empty fields — never a required
 * migration for existing rows.
 */
export interface MediaAssetMetadata {
  pages: number | null;
  author: string | null;
  license: string | null;
  brand: string | null;
  colorProfile: string | null;
  cameraData: Record<string, string> | null;
  location: string | null;
  custom: Record<string, string>;
}

/**
 * Pure storage-object metadata — no business-specific fields (category,
 * folder, visibility, workflow status, etc. live on the *owning* record, not
 * here). This is the single reusable attachment system every module (Lead,
 * Client, Event, Document, Contract, Invoice, Payment, Expense, and beyond)
 * points at via owner_type/owner_id. See docs/database.md for the full
 * design rationale, including which future extensions (folders, previews,
 * quotas, search) are additive and don't require changing this shape.
 */
export interface MediaAsset {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  original_filename: string;
  stored_filename: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string;
  extension: string;
  file_size: number;
  checksum: string;
  width: number | null;
  height: number | null;
  duration: number | null;
  version: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  /** Checkpoint 25, Step 3 — Folders & Collections. `null` means "unfiled," never an error state. */
  folder_id: string | null;
  /** Checkpoint 25, Step 5 — Tagging System. */
  tags: string[];
  color_label: string | null;
  priority: "low" | "normal" | "high" | null;
  /** "AI Ready" (spec, Step 5) — a manual flag a member sets, never something this checkpoint infers itself (no external AI, no speculative tagging). */
  ai_ready: boolean;
  /** Checkpoint 25, Step 9 — Approval Workflow. */
  status: MediaAssetStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  /** Notes for *this* version specifically (Step 8's "Version Notes") — not a general-purpose asset description. */
  version_notes: string | null;
  /** Checkpoint 25, Step 4 — Metadata Engine. */
  metadata: MediaAssetMetadata;
}
