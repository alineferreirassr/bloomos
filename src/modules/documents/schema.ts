import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "@/core/enums/documentCategory";
import { DOCUMENT_STATUSES } from "@/core/enums/documentStatus";
import { DOCUMENT_VISIBILITIES } from "@/core/enums/documentVisibility";
import { STORAGE_PROVIDERS } from "@/core/enums/storageProvider";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";

/**
 * Authoritative schemas for the Documents domain, used directly by the data
 * layer (lib/data/documents/) — same precedent as modules/finance/schema.ts.
 * A Document is business metadata only; the physical file is a MediaAsset
 * (see modules/media's own schema/validation) linked via `media_asset_id` —
 * extension/MIME/size/checksum validation lives entirely there now, not
 * here. Deliberately excluded from every input schema below (assigned by
 * the data layer, never by a caller): id, workspace_id, status,
 * file_name/original_file_name/file_extension/mime_type/size_bytes/
 * storage_provider/storage_bucket/storage_path/checksum (all derived from
 * the linked MediaAsset), version/is_latest_version/parent_document_id,
 * uploaded_at, archived_at/deleted_at, created_at/updated_at. Workspace/
 * owner/reference existence and cross-entity consistency are checked by
 * the data layer — a zod schema can't look up another store.
 */

const entityTypeEnum = z.enum(ENTITY_TYPES);

/** Practical owner types for a Document/DocumentFolder today — narrower than the full EntityType union, which also carries lead/document/document_folder for Notes/Timeline reuse. Supplier/inventory_item/team_member are reserved for future modules (see src/types/document.ts) and intentionally not added to EntityType yet. Single source of truth — both lib/data/documents/ and the Documents UI import this rather than each keeping their own copy. */
export const VALID_DOCUMENT_OWNER_TYPES: EntityType[] = [
  "workspace",
  "client",
  "event",
  "contract",
  "invoice",
  "payment",
  "expense",
];

/**
 * Authoritative input for creating a Document's metadata record
 * (createDocumentMetadata). `title` is nullable — a null/empty title falls
 * back to a generic default assigned by the data layer. `media_asset_id`
 * is nullable: a Document is a valid, first-class object with no file
 * attached yet (status stays "draft" until one is linked via
 * updateDocumentMetadata).
 */
export const documentMetadataInputSchema = z
  .object({
    owner_type: entityTypeEnum,
    owner_id: z.string().trim().min(1, "Owner is required"),
    folder_id: z.string().trim().nullable(),
    title: z.string().trim().nullable(),
    description: z.string().trim().nullable(),
    category: z.enum(DOCUMENT_CATEGORIES),
    visibility: z.enum(DOCUMENT_VISIBILITIES),
    media_asset_id: z.string().trim().nullable(),
    expires_at: z.string().trim().nullable(),
    uploaded_by: z.string().trim().nullable(),
    contract_exhibit_id: z.string().trim().nullable(),
    event_id: z.string().trim().nullable(),
    client_id: z.string().trim().nullable(),
    contract_id: z.string().trim().nullable(),
    invoice_id: z.string().trim().nullable(),
    payment_id: z.string().trim().nullable(),
    expense_id: z.string().trim().nullable(),
  })
  .refine((data) => data.title === null || data.title.length > 0, {
    message: "Title cannot be blank",
    path: ["title"],
  });

export type DocumentMetadataInput = z.infer<typeof documentMetadataInputSchema>;

/**
 * Input for creating a new version of an existing Document
 * (createDocumentVersion). `media_asset_id` is nullable — a version can be
 * metadata-only, matching createDocumentMetadata's own precedent, or
 * reference a MediaAsset the caller already uploaded (owner_type:
 * "document", owner_id: the chain root's id) before calling this.
 * `category` is deliberately absent — a version chain always keeps the
 * category of its first version (see core/workflows/documentWorkflow.ts's
 * versioning invariant note on the Document type); only
 * `title`/`visibility`/`expires_at` may be overridden per version,
 * everything else not listed here is inherited from the version being
 * superseded.
 */
export const newDocumentVersionInputSchema = z
  .object({
    document_id: z.string().trim().min(1, "Document is required"),
    media_asset_id: z.string().trim().nullable(),
    title: z.string().trim().nullable().optional(),
    visibility: z.enum(DOCUMENT_VISIBILITIES).nullable().optional(),
    expires_at: z.string().trim().nullable().optional(),
    uploaded_by: z.string().trim().nullable(),
  })
  .refine((data) => data.title === null || data.title === undefined || data.title.length > 0, {
    message: "Title cannot be blank",
    path: ["title"],
  });

export type NewDocumentVersionInput = z.infer<typeof newDocumentVersionInputSchema>;

/**
 * Full persisted-record shape for a Document — validates invariants that
 * span the whole record (expiration after upload, version-chain root
 * starting at 1, storage path safety when a file is attached) rather than
 * being consumed as a create/update input. Used by tests and available to
 * the data layer as a final invariant check after building a new record.
 * Extension/MIME/size/checksum validity is the Media Library's own
 * responsibility (see lib/media/schema.ts), not re-checked here.
 */
export const documentSchema = z
  .object({
    id: z.string().trim().min(1),
    workspace_id: z.string().trim().min(1),
    owner_type: entityTypeEnum,
    owner_id: z.string().trim().min(1),
    folder_id: z.string().trim().nullable(),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().nullable(),
    category: z.enum(DOCUMENT_CATEGORIES),
    status: z.enum(DOCUMENT_STATUSES),
    visibility: z.enum(DOCUMENT_VISIBILITIES),
    media_asset_id: z.string().trim().nullable(),
    file_name: z.string().trim().nullable(),
    original_file_name: z.string().trim().nullable(),
    file_extension: z.string().trim().nullable(),
    mime_type: z.string().trim().nullable(),
    size_bytes: z.number().int().nonnegative().nullable(),
    storage_provider: z.enum(STORAGE_PROVIDERS),
    storage_bucket: z.string().trim().nullable(),
    storage_path: z.string().trim().nullable(),
    checksum: z.string().trim().nullable(),
    version: z.number().int().positive(),
    is_latest_version: z.boolean(),
    parent_document_id: z.string().trim().nullable(),
    contract_exhibit_id: z.string().trim().nullable(),
    event_id: z.string().trim().nullable(),
    client_id: z.string().trim().nullable(),
    contract_id: z.string().trim().nullable(),
    invoice_id: z.string().trim().nullable(),
    payment_id: z.string().trim().nullable(),
    expense_id: z.string().trim().nullable(),
    uploaded_by: z.string().trim().nullable(),
    uploaded_at: z.string().trim().min(1),
    expires_at: z.string().trim().nullable(),
    archived_at: z.string().trim().nullable(),
    deleted_at: z.string().trim().nullable(),
    created_at: z.string().trim().min(1),
    updated_at: z.string().trim().min(1),
  })
  .refine((data) => data.media_asset_id !== null || data.file_name === null, {
    message: "A Document cannot carry file metadata without a linked MediaAsset",
    path: ["media_asset_id"],
  })
  .refine((data) => data.expires_at === null || data.expires_at > data.uploaded_at, {
    message: "Expiration date must be after the upload date",
    path: ["expires_at"],
  })
  .refine((data) => data.parent_document_id !== null || data.version === 1, {
    message: "The first version in a chain must be version 1",
    path: ["version"],
  });

export type DocumentInput = z.infer<typeof documentSchema>;

/**
 * Authoritative input for creating or updating a DocumentFolder. Cycle
 * prevention and cross-Workspace/cross-owner move rules can't be expressed
 * here (they need the full folder list) — see
 * core/workflows/documentFolderWorkflow.ts's wouldCreateFolderCycle/
 * canMoveFolder, which the data layer calls alongside this schema.
 */
export const documentFolderInputSchema = z.object({
  owner_type: entityTypeEnum,
  owner_id: z.string().trim().min(1, "Owner is required"),
  parent_folder_id: z.string().trim().nullable(),
  name: z.string().trim().min(1, "Folder name is required"),
  description: z.string().trim().nullable(),
  sort_order: z.number().int().nonnegative(),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
});

export type DocumentFolderInput = z.infer<typeof documentFolderInputSchema>;

/** Full persisted-record shape for a DocumentFolder — used by tests and any defensive invariant check. */
export const documentFolderSchema = z.object({
  id: z.string().trim().min(1),
  workspace_id: z.string().trim().min(1),
  owner_type: entityTypeEnum,
  owner_id: z.string().trim().min(1),
  parent_folder_id: z.string().trim().nullable(),
  name: z.string().trim().min(1, "Folder name is required"),
  description: z.string().trim().nullable(),
  sort_order: z.number().int().nonnegative(),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
  created_at: z.string().trim().min(1),
  updated_at: z.string().trim().min(1),
  archived_at: z.string().trim().nullable(),
});

export type DocumentFolderRecord = z.infer<typeof documentFolderSchema>;

/**
 * Client-side (react-hook-form) form schemas for the Documents UI — every
 * field is a plain string or boolean, matching what HTML form inputs
 * actually produce, mirroring modules/finance/schema.ts's
 * invoiceFormSchema/invoiceFormToInput split. Metadata creation and file
 * attachment are two separate forms/actions (see the architecture note in
 * src/types/document.ts) — this form never carries file bytes or
 * file-metadata fields; those belong to the Media Library's own upload
 * flow, whose resulting `media_asset_id` this form (or the version form
 * below) simply references.
 */
export const documentMetadataFormSchema = z.object({
  owner_type: entityTypeEnum,
  owner_id: z.string().trim().min(1, "Owner is required"),
  folder_id: z.string().trim(),
  title: z.string().trim(),
  description: z.string().trim(),
  category: z.enum(DOCUMENT_CATEGORIES),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
  expires_at: z.string().trim(),
  contract_exhibit_id: z.string().trim(),
  event_id: z.string().trim(),
  client_id: z.string().trim(),
  contract_id: z.string().trim(),
  invoice_id: z.string().trim(),
  payment_id: z.string().trim(),
  expense_id: z.string().trim(),
});

export type DocumentMetadataFormInput = z.infer<typeof documentMetadataFormSchema>;

export function documentMetadataFormToInput(data: DocumentMetadataFormInput): DocumentMetadataInput {
  return {
    owner_type: data.owner_type,
    owner_id: data.owner_id,
    folder_id: data.folder_id === "" ? null : data.folder_id,
    title: data.title === "" ? null : data.title,
    description: data.description === "" ? null : data.description,
    category: data.category,
    visibility: data.visibility,
    media_asset_id: null,
    expires_at: data.expires_at === "" ? null : data.expires_at,
    uploaded_by: null,
    contract_exhibit_id: data.contract_exhibit_id === "" ? null : data.contract_exhibit_id,
    event_id: data.event_id === "" ? null : data.event_id,
    client_id: data.client_id === "" ? null : data.client_id,
    contract_id: data.contract_id === "" ? null : data.contract_id,
    invoice_id: data.invoice_id === "" ? null : data.invoice_id,
    payment_id: data.payment_id === "" ? null : data.payment_id,
    expense_id: data.expense_id === "" ? null : data.expense_id,
  };
}

/** Narrow edit form — mirrors updateDocumentMetadata's own narrow signature (title/description/category/expires_at only; file content, folder, status, and visibility each have their own dedicated action). */
export const documentEditMetadataFormSchema = z.object({
  title: z.string().trim(),
  description: z.string().trim(),
  category: z.enum(DOCUMENT_CATEGORIES),
  expires_at: z.string().trim(),
});

export type DocumentEditMetadataFormInput = z.infer<typeof documentEditMetadataFormSchema>;

export interface DocumentEditMetadataInput {
  title: string | null;
  description: string | null;
  category: (typeof DOCUMENT_CATEGORIES)[number];
  expires_at: string | null;
}

export function documentEditMetadataFormToInput(data: DocumentEditMetadataInput): DocumentEditMetadataInput {
  return {
    title: data.title === "" ? null : data.title,
    description: data.description === "" ? null : data.description,
    category: data.category,
    expires_at: data.expires_at === "" ? null : data.expires_at,
  };
}

/**
 * Form for attaching or replacing a MediaAsset link — used both for the
 * "attach a file" action after createDocumentMetadata (via
 * updateDocumentMetadata) and for the "Add New Version" flow
 * (createDocumentVersion). `media_asset_id` is the id returned by a prior,
 * separate call to the Media Library's uploadMediaAsset — this form never
 * touches file bytes directly. Left blank, the resulting Document/version
 * stays metadata-only. `category` is never part of the version form since
 * a version chain always keeps its root's category.
 */
export const newDocumentVersionFormSchema = z.object({
  media_asset_id: z.string().trim(),
  title: z.string().trim(),
  visibility: z.union([z.enum(DOCUMENT_VISIBILITIES), z.literal("")]),
  expires_at: z.string().trim(),
});

export type NewDocumentVersionFormInput = z.infer<typeof newDocumentVersionFormSchema>;

export function newDocumentVersionFormToInput(
  documentId: string,
  data: NewDocumentVersionFormInput,
): NewDocumentVersionInput {
  return {
    document_id: documentId,
    media_asset_id: data.media_asset_id === "" ? null : data.media_asset_id,
    title: data.title === "" ? null : data.title,
    visibility: data.visibility === "" ? null : data.visibility,
    expires_at: data.expires_at === "" ? null : data.expires_at,
    uploaded_by: null,
  };
}

/** Create/rename form for a DocumentFolder — owner_type/owner_id/parent_folder_id/sort_order are supplied programmatically by the caller (the current folder page already knows them), never user-entered. */
export const documentFolderFormSchema = z.object({
  name: z.string().trim().min(1, "Folder name is required"),
  description: z.string().trim(),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
});

export type DocumentFolderFormInput = z.infer<typeof documentFolderFormSchema>;
