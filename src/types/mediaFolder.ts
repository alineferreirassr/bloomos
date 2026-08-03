import type { EntityType } from "@/core/enums/entityType";

/**
 * v2.0 Checkpoint 25, Step 3 — Folders for the Asset Library. Mirrors
 * `types/documentFolder.ts`'s own shape exactly (`parent_folder_id`,
 * `owner_type`/`owner_id`, `sort_order`) — the Document Platform's folder
 * tree (`core/workflows/documentFolderWorkflow.ts`) is the one complete,
 * working precedent for a folder hierarchy in this codebase; this is the
 * MediaAsset-scoped sibling, not a rebuild of that logic. `owner_type: null`/
 * `owner_id: null` means a workspace-wide folder (the common case for a
 * general Asset Library, distinct from Document folders which are always
 * scoped to one owner).
 */
export interface MediaFolder {
  id: string;
  workspace_id: string;
  owner_type: EntityType | null;
  owner_id: string | null;
  parent_folder_id: string | null;
  name: string;
  sort_order: number;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
