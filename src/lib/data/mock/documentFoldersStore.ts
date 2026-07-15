import type { DocumentFolder } from "@/types/documentFolder";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";

/**
 * Hand-curated folders for a handful of owners (not a full
 * applyDefaultFolderTemplate() run for every seed owner — that stays an
 * on-demand data-layer action, never auto-applied globally). Includes one
 * nested folder (Finance -> Invoices under Event 1) to exercise
 * getFolderChildren/getFolderDescendants/getFolderPath, and one archived
 * folder to exercise archiveDocumentFolder/restoreDocumentFolder.
 */
const SEED_DOCUMENT_FOLDERS: DocumentFolder[] = [
  {
    id: "docfolder_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "contract",
    owner_id: "contract_1",
    parent_folder_id: null,
    name: "Main Contract",
    description: "Unsigned draft versions of the Contract.",
    sort_order: 0,
    visibility: "internal",
    created_at: "2026-06-10T09:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "contract",
    owner_id: "contract_1",
    parent_folder_id: null,
    name: "Signed Versions",
    description: "The fully executed Contract.",
    sort_order: 1,
    visibility: "client_and_team",
    created_at: "2026-06-10T09:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "contract",
    owner_id: "contract_1",
    parent_folder_id: null,
    name: "Exhibits",
    description: null,
    sort_order: 2,
    visibility: "client_and_team",
    created_at: "2026-06-10T09:00:00.000Z",
    updated_at: "2026-06-10T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    parent_folder_id: null,
    name: "Finance",
    description: null,
    sort_order: 0,
    visibility: "internal",
    created_at: "2026-06-11T09:00:00.000Z",
    updated_at: "2026-06-11T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    parent_folder_id: "docfolder_4",
    name: "Invoices",
    description: null,
    sort_order: 0,
    visibility: "client_and_team",
    created_at: "2026-06-11T09:05:00.000Z",
    updated_at: "2026-06-11T09:05:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    parent_folder_id: null,
    name: "Moodboards",
    description: null,
    sort_order: 1,
    visibility: "client_and_team",
    created_at: "2026-06-11T09:00:00.000Z",
    updated_at: "2026-06-11T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    parent_folder_id: null,
    name: "Floor Plans",
    description: null,
    sort_order: 2,
    visibility: "team",
    created_at: "2026-06-11T09:00:00.000Z",
    updated_at: "2026-06-11T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_8",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "event",
    owner_id: "event_1",
    parent_folder_id: null,
    name: "Schedule",
    description: null,
    sort_order: 3,
    visibility: "team",
    created_at: "2026-06-11T09:00:00.000Z",
    updated_at: "2026-06-11T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_9",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_2",
    parent_folder_id: null,
    name: "Contracts",
    description: null,
    sort_order: 0,
    visibility: "client_and_team",
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-05T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_10",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_2",
    parent_folder_id: null,
    name: "Identification",
    description: null,
    sort_order: 1,
    visibility: "internal",
    created_at: "2026-06-05T09:00:00.000Z",
    updated_at: "2026-06-05T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "docfolder_11",
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: "client",
    owner_id: "client_3",
    parent_folder_id: null,
    name: "Old Requests (2025)",
    description: "Superseded by the current planning folder structure.",
    sort_order: 0,
    visibility: "internal",
    created_at: "2025-11-01T09:00:00.000Z",
    updated_at: "2026-05-01T09:00:00.000Z",
    archived_at: "2026-05-01T09:00:00.000Z",
  },
];

let documentFolders: DocumentFolder[] = SEED_DOCUMENT_FOLDERS.map((folder) => ({ ...folder }));

export function readDocumentFolders(): DocumentFolder[] {
  return documentFolders;
}

export function writeDocumentFolders(next: DocumentFolder[]): void {
  documentFolders = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetDocumentFoldersStore(): void {
  documentFolders = SEED_DOCUMENT_FOLDERS.map((folder) => ({ ...folder }));
}
