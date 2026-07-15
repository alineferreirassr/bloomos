import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentStatus } from "@/core/enums/documentStatus";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import type { StorageProvider } from "@/core/enums/storageProvider";
import type { EntityType } from "@/core/enums/entityType";

/**
 * The single shared file record for BloomOS — every module (Client, Event,
 * Contract, Contract Exhibit, Invoice, Payment, Expense, and eventually
 * Supplier/Inventory Item/Team Member/Client Portal/Team Portal) attaches
 * files through this one Document type rather than a per-module upload
 * system. `owner_type`/`owner_id` is the authoritative owner (same
 * polymorphic pattern as Note/TimelineActivity — see docs/database.md's
 * "Polymorphic ownership" note); `owner_type` is practically one of
 * `workspace`, `client`, `event`, `contract`, `invoice`, `payment`,
 * `expense` today, with `supplier`/`inventory_item`/`team_member` reserved
 * for future modules once they exist (not yet added to EntityType — no
 * module owns those ids yet, the same "field exists, no module owns it
 * yet" precedent as ContractExhibit.document_id).
 *
 * This is Phase 1: metadata only. `storage_provider`/`storage_bucket`/
 * `storage_path` describe *where a real file would live*, but no binary
 * upload, base64 content, or real storage connection exists yet — every
 * mock Document uses `storage_provider: "mock"`. See docs/database.md's
 * Documents section and docs/integrations.md for the planned Supabase
 * Storage integration.
 *
 * Versioning is a `parent_document_id` + `version` chain, not a snapshot
 * array like Contract.version_history: the first version of a file is its
 * own chain root (`parent_document_id: null`, `version: 1`), and every
 * later version points `parent_document_id` at that same root, incrementing
 * `version`. Exactly one row in a chain has `is_latest_version: true` at
 * any time — see core/workflows/documentWorkflow.ts and
 * lib/data/index.ts's createDocumentVersion for the invariant this enforces
 * centrally; never toggle `is_latest_version` by hand.
 *
 * `folder_id` is nullable — a Document doesn't have to live in a folder.
 * The typed reference fields (`contract_exhibit_id`, `event_id`,
 * `client_id`, `contract_id`, `invoice_id`, `payment_id`, `expense_id`) are
 * for cross-module navigation/lookup only (e.g. "show every Document
 * referencing this Invoice") — they never replace or duplicate the
 * authoritative `owner_type`/`owner_id` pair.
 *
 * `status` follows soft-delete semantics: a `deleted` Document is never
 * physically removed from the store, only flagged (`deleted_at` set) — see
 * core/enums/documentStatus.ts. `visibility` is metadata only in this
 * phase; no authentication or access enforcement reads it yet (see
 * docs/permissions.md).
 */
export interface Document {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  category: DocumentCategory;
  status: DocumentStatus;
  visibility: DocumentVisibility;
  file_name: string;
  original_file_name: string;
  file_extension: string;
  mime_type: string;
  size_bytes: number;
  storage_provider: StorageProvider;
  storage_bucket: string;
  storage_path: string;
  checksum: string | null;
  version: number;
  is_latest_version: boolean;
  parent_document_id: string | null;
  contract_exhibit_id: string | null;
  event_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  expense_id: string | null;
  uploaded_by: string | null;
  uploaded_at: string;
  expires_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}
