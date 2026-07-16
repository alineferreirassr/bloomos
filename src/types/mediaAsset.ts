import type { EntityType } from "@/core/enums/entityType";

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
}
