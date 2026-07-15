import { z } from "zod";
import { DOCUMENT_CATEGORIES } from "@/core/enums/documentCategory";
import { DOCUMENT_STATUSES } from "@/core/enums/documentStatus";
import { DOCUMENT_VISIBILITIES } from "@/core/enums/documentVisibility";
import { STORAGE_PROVIDERS } from "@/core/enums/storageProvider";
import { ENTITY_TYPES } from "@/core/enums/entityType";
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
