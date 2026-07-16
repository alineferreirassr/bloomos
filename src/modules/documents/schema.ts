import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "@/core/enums/documentCategory";
import { DOCUMENT_STATUSES } from "@/core/enums/documentStatus";
import { DOCUMENT_VISIBILITIES } from "@/core/enums/documentVisibility";
import { STORAGE_PROVIDERS } from "@/core/enums/storageProvider";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import {
  extractFileExtension,
  isAllowedFileExtension,
  isBlockedFileExtension,
  validateMimeType,
  validateFileSize,
  isSafeStoragePath,
} from "@/lib/documentFile";

/**
 * Authoritative schemas for the Documents domain, used directly by the data
 * layer (lib/data/index.ts) — same precedent as modules/finance/schema.ts:
 * no upload UI exists yet in this phase, so there's no HTML form producing
 * string-only values to normalize; a form-schema layer can be added later
 * without changing these shapes. Deliberately excluded from every input
 * schema below (assigned by the data layer, never by a caller): id,
 * workspace_id, status, storage_provider/storage_bucket/storage_path,
 * checksum, file_extension, version/is_latest_version/parent_document_id,
 * uploaded_at, archived_at/deleted_at, created_at/updated_at.
 * Workspace/owner/reference existence and cross-entity consistency are
 * checked by the data layer — a zod schema can't look up another store.
 */

const entityTypeEnum = z.enum(ENTITY_TYPES);

/** Practical owner types for a Document/DocumentFolder today — narrower than the full EntityType union, which also carries lead/document/document_folder for Notes/Timeline reuse. Supplier/inventory_item/team_member are reserved for future modules (see src/types/document.ts) and intentionally not added to EntityType yet. Single source of truth — both lib/data/index.ts and the Documents UI import this rather than each keeping their own copy. */
export const VALID_DOCUMENT_OWNER_TYPES: EntityType[] = [
  "workspace",
  "client",
  "event",
  "contract",
  "invoice",
  "payment",
  "expense",
];

function extensionRefinement(fileName: string): { valid: boolean; error: string | null } {
  const extension = extractFileExtension(fileName);
  if (extension === "") return { valid: false, error: "File name must have an extension" };
  if (isBlockedFileExtension(extension)) return { valid: false, error: `File type ".${extension}" is not allowed` };
  if (!isAllowedFileExtension(extension)) {
    return { valid: false, error: `File type ".${extension}" is not supported` };
  }
  return { valid: true, error: null };
}

/**
 * Authoritative input for uploading a new Document (createDocumentMetadata).
 * `title` is nullable — a null/empty title is auto-generated from
 * `file_name` (see lib/documentFile.ts's generateDocumentTitle) by the data
 * layer, which is also where extension/MIME/size are validated together
 * (a zod `.refine()` can check `file_name` against `mime_type`/`size_bytes`
 * within a single object, so that part happens here too).
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
    file_name: z.string().trim().min(1, "File name is required"),
    mime_type: z.string().trim().min(1, "MIME type is required"),
    size_bytes: z.number().int().positive("Enter a valid file size"),
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
  })
  .refine((data) => extensionRefinement(data.file_name).valid, {
    message: "Unsupported or missing file extension",
    path: ["file_name"],
  })
  .refine((data) => validateMimeType(data.mime_type, extractFileExtension(data.file_name)).valid, {
    message: "MIME type does not match the file extension",
    path: ["mime_type"],
  })
  .refine((data) => validateFileSize(data.size_bytes, extractFileExtension(data.file_name)).valid, {
    message: "File exceeds the size limit for this file type",
    path: ["size_bytes"],
  });

export type DocumentMetadataInput = z.infer<typeof documentMetadataInputSchema>;

/**
 * Input for uploading a new version of an existing Document
 * (createDocumentVersion). `category` is deliberately absent — a version
 * chain always keeps the category of its first version (see
 * core/workflows/documentWorkflow.ts's versioning invariant note on the
 * Document type); only `title`/`visibility`/`expires_at` may be overridden
 * per version, everything else not listed here is inherited from the
 * version being superseded.
 */
export const newDocumentVersionInputSchema = z
  .object({
    document_id: z.string().trim().min(1, "Document is required"),
    file_name: z.string().trim().min(1, "File name is required"),
    mime_type: z.string().trim().min(1, "MIME type is required"),
    size_bytes: z.number().int().positive("Enter a valid file size"),
    title: z.string().trim().nullable().optional(),
    visibility: z.enum(DOCUMENT_VISIBILITIES).nullable().optional(),
    expires_at: z.string().trim().nullable().optional(),
    uploaded_by: z.string().trim().nullable(),
  })
  .refine((data) => data.title === null || data.title === undefined || data.title.length > 0, {
    message: "Title cannot be blank",
    path: ["title"],
  })
  .refine((data) => extensionRefinement(data.file_name).valid, {
    message: "Unsupported or missing file extension",
    path: ["file_name"],
  })
  .refine((data) => validateMimeType(data.mime_type, extractFileExtension(data.file_name)).valid, {
    message: "MIME type does not match the file extension",
    path: ["mime_type"],
  })
  .refine((data) => validateFileSize(data.size_bytes, extractFileExtension(data.file_name)).valid, {
    message: "File exceeds the size limit for this file type",
    path: ["size_bytes"],
  });

export type NewDocumentVersionInput = z.infer<typeof newDocumentVersionInputSchema>;

/**
 * Full persisted-record shape for a Document — validates invariants that
 * span the whole record (storage path safety, extension/MIME/size
 * agreement, expiration after upload, version-chain root starting at 1)
 * rather than being consumed as a create/update input. Used by tests and
 * available to the data layer as a final invariant check after building a
 * new record.
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
    file_name: z.string().trim().min(1),
    original_file_name: z.string().trim().min(1),
    file_extension: z.string().trim().min(1),
    mime_type: z.string().trim().min(1),
    size_bytes: z.number().int().positive(),
    storage_provider: z.enum(STORAGE_PROVIDERS),
    storage_bucket: z.string().trim().min(1),
    storage_path: z.string().trim().min(1),
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
  .refine((data) => !isBlockedFileExtension(data.file_extension) && isAllowedFileExtension(data.file_extension), {
    message: "Unsupported or blocked file extension",
    path: ["file_extension"],
  })
  .refine((data) => validateMimeType(data.mime_type, data.file_extension).valid, {
    message: "MIME type does not match the file extension",
    path: ["mime_type"],
  })
  .refine((data) => validateFileSize(data.size_bytes, data.file_extension).valid, {
    message: "File exceeds the size limit for this file type",
    path: ["size_bytes"],
  })
  .refine((data) => isSafeStoragePath(data.storage_path), {
    message: "Storage path is not safe (must be relative, no .. traversal)",
    path: ["storage_path"],
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
 * invoiceFormSchema/invoiceFormToInput split. `size_mb` is entered in
 * megabytes (e.g. "2.5") since that's what a human reasons in; each
 * `*FormToInput` below converts it to `size_bytes` before handing the value
 * to the authoritative schema above — the data layer never sees a
 * megabyte figure. Extension/MIME/size validity, owner/reference
 * consistency, and folder ownership are re-checked by the authoritative
 * schema and the data layer regardless of what passes here.
 */

const BYTES_PER_MB = 1024 * 1024;

const megabyteString = z
  .string()
  .trim()
  .refine((v) => v !== "" && !Number.isNaN(Number(v)) && Number(v) > 0, { message: "Enter a size greater than zero" });

export const documentMetadataFormSchema = z.object({
  owner_type: entityTypeEnum,
  owner_id: z.string().trim().min(1, "Owner is required"),
  folder_id: z.string().trim(),
  title: z.string().trim(),
  description: z.string().trim(),
  category: z.enum(DOCUMENT_CATEGORIES),
  visibility: z.enum(DOCUMENT_VISIBILITIES),
  original_file_name: z.string().trim().min(1, "File name is required"),
  mime_type: z.string().trim().min(1, "MIME type is required"),
  size_mb: megabyteString,
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
    file_name: data.original_file_name,
    mime_type: data.mime_type,
    size_bytes: Math.round(Number(data.size_mb) * BYTES_PER_MB),
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

/** Narrow edit form — mirrors updateDocumentMetadata's own narrow signature (title/description/category/expires_at only; file content/folder/status/visibility each have their own dedicated action). */
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

export function documentEditMetadataFormToInput(data: DocumentEditMetadataFormInput): DocumentEditMetadataInput {
  return {
    title: data.title === "" ? null : data.title,
    description: data.description === "" ? null : data.description,
    category: data.category,
    expires_at: data.expires_at === "" ? null : data.expires_at,
  };
}

/** Form for the "Add New Version" flow (createDocumentVersion) — category is never part of this form since a version chain always keeps its root's category. */
export const newDocumentVersionFormSchema = z.object({
  original_file_name: z.string().trim().min(1, "File name is required"),
  mime_type: z.string().trim().min(1, "MIME type is required"),
  size_mb: megabyteString,
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
    file_name: data.original_file_name,
    mime_type: data.mime_type,
    size_bytes: Math.round(Number(data.size_mb) * BYTES_PER_MB),
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
