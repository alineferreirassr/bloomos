import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import type { EntityType } from "@/core/enums/entityType";

/**
 * A named container Documents can be filed into, scoped to the same
 * `owner_type`/`owner_id` pair as the Documents it holds (a folder never
 * spans multiple owners). Folders nest via `parent_folder_id`; a root-level
 * folder for an owner has `parent_folder_id: null`. See
 * core/workflows/documentWorkflow.ts's folder helpers (wouldCreateFolderCycle,
 * canMoveFolder) for the centralized rules that keep the tree well-formed —
 * a folder can never become its own ancestor, and moveDocumentFolder refuses
 * to move a folder across Workspaces or owners.
 *
 * `visibility` mirrors Document.visibility (metadata only, no access
 * enforcement yet) and is a *default* new Documents in the folder may
 * inherit at creation time — it never overrides a Document's own
 * `visibility` after the fact.
 */
export interface DocumentFolder {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  sort_order: number;
  visibility: DocumentVisibility;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
