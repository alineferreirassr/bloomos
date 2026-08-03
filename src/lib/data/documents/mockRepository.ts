import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { EntityType } from "@/core/enums/entityType";
import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import { NotFoundError } from "@/core/errors";
import { DOCUMENT_STATUS_LABELS, canTransitionDocumentStatus, getDocumentNextRecommendedAction } from "@/core/workflows/documentWorkflow";
import { canMoveFolder, getFolderPath, getFolderChildren } from "@/core/workflows/documentFolderWorkflow";
import {
  documentMetadataInputSchema,
  newDocumentVersionInputSchema,
  documentFolderInputSchema,
  VALID_DOCUMENT_OWNER_TYPES,
  type DocumentMetadataInput,
  type NewDocumentVersionInput,
  type DocumentFolderInput,
} from "@/modules/documents/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import {
  computeDocumentOwnerSummary,
  computeDocumentWorkspaceSummary,
  type DocumentOwnerSummary,
  type DocumentWorkspaceSummary,
} from "@/modules/documents/documentStats";
import { DOCUMENT_FOLDER_TEMPLATES, type FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { mockMediaAssetsRepository } from "@/lib/data/media/mockRepository";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { readContracts } from "@/lib/data/mock/contractsStore";
import { readContractExhibits } from "@/lib/data/mock/contractExhibitsStore";
import { readInvoices } from "@/lib/data/mock/invoicesStore";
import { readPayments } from "@/lib/data/mock/paymentsStore";
import { readExpenses } from "@/lib/data/mock/expensesStore";
import { readDocuments, writeDocuments } from "@/lib/data/mock/documentsStore";
import { readDocumentFolders, writeDocumentFolders } from "@/lib/data/mock/documentFoldersStore";
import { readNotes, writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type {
  DocumentFilters,
  DocumentFolderFilters,
  DocumentFolderTreeNode,
  DocumentMetadataUpdateInput,
  DocumentReferenceType,
  DocumentsRepository,
} from "@/lib/data/documents/repository";

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function documentReferenceValue(document: Document, referenceType: DocumentReferenceType): string | null {
  switch (referenceType) {
    case "contract_exhibit":
      return document.contract_exhibit_id;
    case "event":
      return document.event_id;
    case "client":
      return document.client_id;
    case "contract":
      return document.contract_id;
    case "invoice":
      return document.invoice_id;
    case "payment":
      return document.payment_id;
    case "expense":
      return document.expense_id;
  }
}

/**
 * Validates the owner and every typed reference field a Document create/
 * version input carries: each referenced id must exist, and where two
 * references overlap (Client/Event/Contract), they must agree with each
 * other — the same cross-entity consistency createExpense/createInvoice
 * already enforce for event_id/contract_id vs client_id.
 */
function validateDocumentOwnerAndReferences(input: {
  owner_type: EntityType;
  owner_id: string;
  folder_id: string | null;
  contract_exhibit_id: string | null;
  event_id: string | null;
  client_id: string | null;
  contract_id: string | null;
  invoice_id: string | null;
  payment_id: string | null;
  expense_id: string | null;
}): Partial<Record<string, string>> | null {
  if (!VALID_DOCUMENT_OWNER_TYPES.includes(input.owner_type)) {
    return { owner_type: "Documents cannot be owned by this entity type yet." };
  }

  if (input.owner_type === "workspace") {
    if (input.owner_id !== CURRENT_WORKSPACE_ID) return { owner_id: "Unknown Workspace." };
  } else if (input.owner_type === "client") {
    if (!readClients().some((c) => c.id === input.owner_id)) return { owner_id: "Client not found." };
  } else if (input.owner_type === "event") {
    if (!readEvents().some((e) => e.id === input.owner_id)) return { owner_id: "Event not found." };
  } else if (input.owner_type === "contract") {
    if (!readContracts().some((c) => c.id === input.owner_id)) return { owner_id: "Contract not found." };
  } else if (input.owner_type === "invoice") {
    if (!readInvoices().some((i) => i.id === input.owner_id)) return { owner_id: "Invoice not found." };
  } else if (input.owner_type === "payment") {
    if (!readPayments().some((p) => p.id === input.owner_id)) return { owner_id: "Payment not found." };
  } else if (input.owner_type === "expense") {
    if (!readExpenses().some((e) => e.id === input.owner_id)) return { owner_id: "Expense not found." };
  }

  if (input.folder_id !== null) {
    const folder = readDocumentFolders().find((f) => f.id === input.folder_id);
    if (!folder) return { folder_id: "Folder not found." };
    if (folder.owner_type !== input.owner_type || folder.owner_id !== input.owner_id) {
      return { folder_id: "Folder belongs to a different owner." };
    }
  }

  const client = input.client_id !== null ? readClients().find((c) => c.id === input.client_id) : null;
  if (input.client_id !== null && !client) return { client_id: "Client not found." };

  const event = input.event_id !== null ? readEvents().find((e) => e.id === input.event_id) : null;
  if (input.event_id !== null && !event) return { event_id: "Event not found." };
  if (event && input.client_id !== null && event.client_id !== input.client_id) {
    return { event_id: "Event belongs to a different client." };
  }

  const contract = input.contract_id !== null ? readContracts().find((c) => c.id === input.contract_id) : null;
  if (input.contract_id !== null && !contract) return { contract_id: "Contract not found." };
  if (contract && input.client_id !== null && contract.client_id !== input.client_id) {
    return { contract_id: "Contract belongs to a different client." };
  }
  if (contract && input.event_id !== null && contract.event_id !== null && contract.event_id !== input.event_id) {
    return { contract_id: "Contract belongs to a different event." };
  }

  if (input.contract_exhibit_id !== null && !readContractExhibits().some((x) => x.id === input.contract_exhibit_id)) {
    return { contract_exhibit_id: "Contract Exhibit not found." };
  }
  if (input.invoice_id !== null && !readInvoices().some((i) => i.id === input.invoice_id)) {
    return { invoice_id: "Invoice not found." };
  }
  if (input.payment_id !== null && !readPayments().some((p) => p.id === input.payment_id)) {
    return { payment_id: "Payment not found." };
  }
  if (input.expense_id !== null && !readExpenses().some((e) => e.id === input.expense_id)) {
    return { expense_id: "Expense not found." };
  }

  return null;
}

/** The fields derived from a linked MediaAsset — never independently generated here, always copied from the Media Library's own upload/validation response. Null across the board when no MediaAsset is linked. */
interface DerivedMediaFields {
  file_name: string | null;
  original_file_name: string | null;
  file_extension: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_bucket: string | null;
  storage_path: string | null;
  checksum: string | null;
}

const EMPTY_MEDIA_FIELDS: DerivedMediaFields = {
  file_name: null,
  original_file_name: null,
  file_extension: null,
  mime_type: null,
  size_bytes: null,
  storage_bucket: null,
  storage_path: null,
  checksum: null,
};

/**
 * Resolves the fields a Document copies from its linked MediaAsset —
 * `null` MediaAsset id means metadata-only (every field null). Returns
 * `null` (distinct from EMPTY_MEDIA_FIELDS) when a non-null id doesn't
 * resolve to a real MediaAsset, so callers can fail() instead of silently
 * linking a dangling id.
 */
async function resolveMediaFields(mediaAssetId: string | null): Promise<DerivedMediaFields | null> {
  if (mediaAssetId === null) return EMPTY_MEDIA_FIELDS;
  try {
    const asset = await mockMediaAssetsRepository.getMediaAssetById(mediaAssetId);
    return {
      file_name: asset.stored_filename,
      original_file_name: asset.original_filename,
      file_extension: asset.extension,
      mime_type: asset.mime_type,
      size_bytes: asset.file_size,
      storage_bucket: asset.storage_bucket,
      storage_path: asset.storage_path,
      checksum: asset.checksum,
    };
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

async function getDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  await delay(200);
  const {
    search,
    ownerType,
    ownerId,
    category,
    status,
    visibility,
    mimeType,
    extension,
    folderId,
    uploadedFrom,
    uploadedTo,
    expiresFrom,
    expiresTo,
    includeArchived = false,
    includeDeleted = false,
    latestVersionOnly = false,
    referenceType,
    referenceId,
    sortBy = "uploaded_at",
    sortDirection = "desc",
  } = filters;

  const filtered = readDocuments().filter((document) => {
    if (!includeArchived && document.status === "archived") return false;
    if (!includeDeleted && document.status === "deleted") return false;
    if (ownerType && ownerType !== "all" && document.owner_type !== ownerType) return false;
    if (ownerId && document.owner_id !== ownerId) return false;
    if (category && category !== "all" && document.category !== category) return false;
    if (status && status !== "all" && document.status !== status) return false;
    if (visibility && visibility !== "all" && document.visibility !== visibility) return false;
    if (mimeType && document.mime_type !== mimeType) return false;
    if (extension && document.file_extension !== extension.toLowerCase()) return false;
    if (folderId !== undefined && document.folder_id !== folderId) return false;
    if (uploadedFrom && document.uploaded_at < uploadedFrom) return false;
    if (uploadedTo && document.uploaded_at > uploadedTo) return false;
    if (expiresFrom || expiresTo) {
      if (!document.expires_at) return false;
      if (expiresFrom && document.expires_at < expiresFrom) return false;
      if (expiresTo && document.expires_at > expiresTo) return false;
    }
    if (latestVersionOnly && !document.is_latest_version) return false;
    if (referenceType && referenceId && documentReferenceValue(document, referenceType) !== referenceId) {
      return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = `${document.title} ${document.description ?? ""} ${document.file_name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });

  const direction = sortDirection === "asc" ? 1 : -1;
  return filtered.sort((a, b) => {
    switch (sortBy) {
      case "title":
        return direction * a.title.localeCompare(b.title);
      case "updated_at":
        return direction * a.updated_at.localeCompare(b.updated_at);
      case "size_bytes":
        return direction * ((a.size_bytes ?? 0) - (b.size_bytes ?? 0));
      case "expires_at":
        return direction * (a.expires_at ?? "").localeCompare(b.expires_at ?? "");
      case "version":
        return direction * (a.version - b.version);
      case "uploaded_at":
      default:
        return direction * a.uploaded_at.localeCompare(b.uploaded_at);
    }
  });
}

async function getDocumentById(id: string): Promise<Document> {
  await delay(150);
  const document = readDocuments().find((d) => d.id === id);
  if (!document) {
    throw new NotFoundError(`Document ${id} was not found`);
  }
  return document;
}

async function createDocumentMetadata(input: DocumentMetadataInput): Promise<DataResult<Document>> {
  const parsed = documentMetadataInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const referenceErrors = validateDocumentOwnerAndReferences(data);
  if (referenceErrors) {
    return fail("Please fix the highlighted fields.", referenceErrors);
  }

  const mediaFields = await resolveMediaFields(data.media_asset_id);
  if (mediaFields === null) {
    return fail("Please select a valid file.", { media_asset_id: "MediaAsset not found." });
  }

  const timestamp = nowIso();
  const document: Document = {
    id: generateId("document"),
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: data.owner_type,
    owner_id: data.owner_id,
    folder_id: data.folder_id,
    title: data.title && data.title.length > 0 ? data.title : "Untitled Document",
    description: data.description,
    category: data.category,
    status: "draft",
    visibility: data.visibility,
    media_asset_id: data.media_asset_id,
    ...mediaFields,
    storage_provider: "mock",
    version: 1,
    is_latest_version: true,
    parent_document_id: null,
    contract_exhibit_id: data.contract_exhibit_id,
    event_id: data.event_id,
    client_id: data.client_id,
    contract_id: data.contract_id,
    invoice_id: data.invoice_id,
    payment_id: data.payment_id,
    expense_id: data.expense_id,
    uploaded_by: data.uploaded_by,
    uploaded_at: timestamp,
    expires_at: data.expires_at,
    archived_at: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeDocuments([...readDocuments(), document]);
  recordTimelineActivity(
    document.workspace_id,
    "document",
    document.id,
    "document_created",
    `Document uploaded: "${document.title}"`,
  );

  return ok(document);
}

/** Editable metadata (title/description/category/expires_at) plus an optional MediaAsset link/unlink — folder and status/visibility each go through their own dedicated action. Blocked once the Document is soft-deleted. */
async function updateDocumentMetadata(id: string, input: DocumentMetadataUpdateInput): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }
  if (input.title !== null && input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title cannot be blank." });
  }

  let mediaFields: DerivedMediaFields & { media_asset_id: string | null } = {
    media_asset_id: existing.media_asset_id,
    file_name: existing.file_name,
    original_file_name: existing.original_file_name,
    file_extension: existing.file_extension,
    mime_type: existing.mime_type,
    size_bytes: existing.size_bytes,
    storage_bucket: existing.storage_bucket,
    storage_path: existing.storage_path,
    checksum: existing.checksum,
  };
  if (input.media_asset_id !== undefined) {
    const resolved = await resolveMediaFields(input.media_asset_id);
    if (resolved === null) {
      return fail("Please select a valid file.", { media_asset_id: "MediaAsset not found." });
    }
    mediaFields = { media_asset_id: input.media_asset_id, ...resolved };
  }

  const updated: Document = {
    ...existing,
    title: input.title && input.title.length > 0 ? input.title : existing.title,
    description: input.description,
    category: input.category,
    expires_at: input.expires_at,
    ...mediaFields,
    updated_at: nowIso(),
  };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    id,
    "document_metadata_updated",
    `Document metadata updated: "${updated.title}"`,
  );

  return ok(updated);
}

async function activateDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "active")) {
    return fail(`Cannot activate a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Document = { ...existing, status: "active", updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_activated", "Document activated");

  return ok(updated);
}

function documentChain(anyVersionId: string): Document[] {
  const all = readDocuments();
  const anchor = all.find((d) => d.id === anyVersionId);
  if (!anchor) return [];
  const rootId = anchor.parent_document_id ?? anchor.id;
  return all
    .filter((d) => d.id === rootId || d.parent_document_id === rootId)
    .sort((a, b) => a.version - b.version);
}

/** Every version in the chain containing `documentId` (any version's id may be passed), oldest first. */
async function getDocumentVersions(documentId: string): Promise<Document[]> {
  await delay(150);
  return documentChain(documentId);
}

/** The single is_latest_version: true row in the chain containing `documentId`. */
async function getLatestDocumentVersion(documentId: string): Promise<Document> {
  const chain = documentChain(documentId);
  const latest = chain.find((d) => d.is_latest_version);
  if (!latest) {
    throw new NotFoundError(`Document ${documentId} was not found`);
  }
  return latest;
}

/**
 * Uploads a new version onto an existing chain: builds the new row
 * inheriting owner/category/references/folder from the current latest
 * version, marks that prior latest version `superseded`
 * (is_latest_version: false), and writes both changes in a single batch —
 * a reader never observes a moment with zero or two "latest" versions.
 * `media_asset_id` may be null (a metadata-only new version, matching
 * createDocumentMetadata's own precedent) or reference a MediaAsset the
 * caller already uploaded (owner_type: "document", owner_id: the chain
 * root's id) before calling this. Two Timeline entries are recorded, one
 * per affected Document row: `document_version_created` on the new
 * version, `document_superseded` on the old one.
 */
async function createDocumentVersion(input: NewDocumentVersionInput): Promise<DataResult<Document>> {
  const parsed = newDocumentVersionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const chain = documentChain(data.document_id);
  if (chain.length === 0) {
    return fail("Document not found.");
  }
  const latest = chain.find((d) => d.is_latest_version);
  if (!latest) {
    return fail("This document has no current version to supersede.");
  }
  if (latest.status === "deleted") {
    return fail("This document has been deleted and cannot receive a new version.");
  }

  const mediaFields = await resolveMediaFields(data.media_asset_id);
  if (mediaFields === null) {
    return fail("Please select a valid file.", { media_asset_id: "MediaAsset not found." });
  }

  const rootId = latest.parent_document_id ?? latest.id;
  const title = data.title !== undefined && data.title !== null && data.title.length > 0 ? data.title : latest.title;
  const visibility = data.visibility !== undefined && data.visibility !== null ? data.visibility : latest.visibility;
  const expiresAt = data.expires_at !== undefined ? data.expires_at : latest.expires_at;
  const timestamp = nowIso();

  const newVersion: Document = {
    ...latest,
    id: generateId("document"),
    title,
    status: "active",
    visibility,
    media_asset_id: data.media_asset_id,
    ...mediaFields,
    version: latest.version + 1,
    is_latest_version: true,
    parent_document_id: rootId,
    uploaded_by: data.uploaded_by,
    uploaded_at: timestamp,
    expires_at: expiresAt,
    archived_at: null,
    deleted_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
  const supersededPrevious: Document = { ...latest, status: "superseded", is_latest_version: false, updated_at: timestamp };

  writeDocuments([
    ...readDocuments().filter((d) => d.id !== latest.id),
    supersededPrevious,
    newVersion,
  ]);
  recordTimelineActivity(
    newVersion.workspace_id,
    "document",
    newVersion.id,
    "document_version_created",
    `New version uploaded: "${newVersion.title}" (v${newVersion.version})`,
  );
  recordTimelineActivity(
    supersededPrevious.workspace_id,
    "document",
    supersededPrevious.id,
    "document_superseded",
    `Superseded by version ${newVersion.version}`,
  );

  return ok(newVersion);
}

async function archiveDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "archived")) {
    return fail(`Cannot archive a document that is already ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Document = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_archived", "Document archived");

  return ok(updated);
}

/** Restores an archived or soft-deleted Document back to `active` — the same "reasonable resumption point" precedent as restoreExpense/restoreContract. */
async function restoreDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "active")) {
    return fail(`Cannot restore a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Document = {
    ...existing,
    status: "active",
    archived_at: null,
    deleted_at: null,
    updated_at: nowIso(),
  };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_restored", "Document restored");

  return ok(updated);
}

/** Soft delete only — never physically removes the record. */
async function softDeleteDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "deleted")) {
    return fail(`Cannot delete a document that is already ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const timestamp = nowIso();
  const updated: Document = { ...existing, status: "deleted", deleted_at: timestamp, updated_at: timestamp };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_soft_deleted", "Document deleted");

  return ok(updated);
}

async function expireDocument(id: string): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "expired")) {
    return fail(`Cannot expire a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const updated: Document = { ...existing, status: "expired", updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_expired", "Document expired");

  return ok(updated);
}

async function updateDocumentVisibility(id: string, visibility: DocumentVisibility): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }

  const updated: Document = { ...existing, visibility, updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    id,
    "document_visibility_changed",
    `Visibility changed to ${visibility}`,
  );

  return ok(updated);
}

async function moveDocumentToFolder(id: string, folderId: string | null): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }
  if (folderId !== null) {
    const folder = readDocumentFolders().find((f) => f.id === folderId);
    if (!folder) {
      return fail("Folder not found.");
    }
    if (folder.owner_type !== existing.owner_type || folder.owner_id !== existing.owner_id) {
      return fail("Cannot move a document into a folder belonging to a different owner.");
    }
  }

  const updated: Document = { ...existing, folder_id: folderId, updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === id ? updated : d)));
  recordTimelineActivity(existing.workspace_id, "document", id, "document_moved_to_folder", "Document moved to a different folder");

  return ok(updated);
}

async function getDocumentsByOwner(ownerType: EntityType, ownerId: string): Promise<Document[]> {
  await delay(150);
  return readDocuments().filter((d) => d.owner_type === ownerType && d.owner_id === ownerId);
}

async function getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
  await delay(150);
  return readDocuments().filter((d) => d.category === category);
}

async function getDocumentsByReference(
  referenceType: DocumentReferenceType,
  referenceId: string,
): Promise<Document[]> {
  await delay(150);
  return readDocuments().filter((d) => documentReferenceValue(d, referenceType) === referenceId);
}

async function getDocumentNextAction(documentId: string): Promise<string | null> {
  const document = await getDocumentById(documentId);
  return getDocumentNextRecommendedAction(document);
}

async function getDocumentOwnerSummary(ownerType: EntityType, ownerId: string): Promise<DocumentOwnerSummary> {
  const owned = readDocuments().filter((d) => d.owner_type === ownerType && d.owner_id === ownerId);
  return computeDocumentOwnerSummary(owned);
}

async function getWorkspaceDocumentSummary(): Promise<DocumentWorkspaceSummary> {
  return computeDocumentWorkspaceSummary(readDocuments());
}

// ---------------------------------------------------------------------------
// Placeholder attachment helpers — update a Document's own typed reference
// field only. Never rewrites the other side's document_id placeholder
// field on ContractExhibit/Payment/Expense — additive and
// backward-compatible, per the Contracts/Finance foundations those fields
// were introduced in.
// ---------------------------------------------------------------------------

async function attachDocumentReference(
  documentId: string,
  patch: Partial<
    Pick<Document, "contract_exhibit_id" | "event_id" | "client_id" | "contract_id" | "invoice_id" | "payment_id" | "expense_id">
  >,
  label: string,
): Promise<DataResult<Document>> {
  const existing = readDocuments().find((d) => d.id === documentId);
  if (!existing) {
    return fail("Document not found.");
  }

  const updated: Document = { ...existing, ...patch, updated_at: nowIso() };
  writeDocuments(readDocuments().map((d) => (d.id === documentId ? updated : d)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    documentId,
    "document_metadata_updated",
    `Document linked to ${label}`,
  );

  return ok(updated);
}

async function attachDocumentToContractExhibit(documentId: string, exhibitId: string): Promise<DataResult<Document>> {
  if (!readContractExhibits().some((x) => x.id === exhibitId)) {
    return fail("Contract Exhibit not found.");
  }
  return attachDocumentReference(documentId, { contract_exhibit_id: exhibitId }, `Contract Exhibit ${exhibitId}`);
}

async function attachDocumentToPayment(documentId: string, paymentId: string): Promise<DataResult<Document>> {
  if (!readPayments().some((p) => p.id === paymentId)) {
    return fail("Payment not found.");
  }
  return attachDocumentReference(documentId, { payment_id: paymentId }, `Payment ${paymentId}`);
}

async function attachDocumentToExpense(documentId: string, expenseId: string): Promise<DataResult<Document>> {
  if (!readExpenses().some((e) => e.id === expenseId)) {
    return fail("Expense not found.");
  }
  return attachDocumentReference(documentId, { expense_id: expenseId }, `Expense ${expenseId}`);
}

async function attachDocumentToInvoice(documentId: string, invoiceId: string): Promise<DataResult<Document>> {
  if (!readInvoices().some((i) => i.id === invoiceId)) {
    return fail("Invoice not found.");
  }
  return attachDocumentReference(documentId, { invoice_id: invoiceId }, `Invoice ${invoiceId}`);
}

async function attachDocumentToEvent(documentId: string, eventId: string): Promise<DataResult<Document>> {
  if (!readEvents().some((e) => e.id === eventId)) {
    return fail("Event not found.");
  }
  return attachDocumentReference(documentId, { event_id: eventId }, `Event ${eventId}`);
}

async function attachDocumentToClient(documentId: string, clientId: string): Promise<DataResult<Document>> {
  if (!readClients().some((c) => c.id === clientId)) {
    return fail("Client not found.");
  }
  return attachDocumentReference(documentId, { client_id: clientId }, `Client ${clientId}`);
}

// ---------------------------------------------------------------------------
// Document Folders
// ---------------------------------------------------------------------------

async function getDocumentFolders(filters: DocumentFolderFilters = {}): Promise<DocumentFolder[]> {
  await delay(150);
  const { ownerType, ownerId, parentFolderId, includeArchived = false } = filters;
  return readDocumentFolders().filter((folder) => {
    if (!includeArchived && folder.archived_at !== null) return false;
    if (ownerType && folder.owner_type !== ownerType) return false;
    if (ownerId && folder.owner_id !== ownerId) return false;
    if (parentFolderId !== undefined && folder.parent_folder_id !== parentFolderId) return false;
    return true;
  });
}

async function getDocumentFolderById(id: string): Promise<DocumentFolder> {
  await delay(100);
  const folder = readDocumentFolders().find((f) => f.id === id);
  if (!folder) {
    throw new NotFoundError(`Document folder ${id} was not found`);
  }
  return folder;
}

async function createDocumentFolder(input: DocumentFolderInput): Promise<DataResult<DocumentFolder>> {
  const parsed = documentFolderInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  if (!VALID_DOCUMENT_OWNER_TYPES.includes(data.owner_type)) {
    return fail("Please fix the highlighted fields.", { owner_type: "Folders cannot be owned by this entity type yet." });
  }
  if (data.parent_folder_id !== null) {
    const parent = readDocumentFolders().find((f) => f.id === data.parent_folder_id);
    if (!parent) {
      return fail("Please fix the highlighted fields.", { parent_folder_id: "Parent folder not found." });
    }
    if (parent.owner_type !== data.owner_type || parent.owner_id !== data.owner_id) {
      return fail("Please fix the highlighted fields.", {
        parent_folder_id: "Parent folder belongs to a different owner.",
      });
    }
  }

  const timestamp = nowIso();
  const folder: DocumentFolder = {
    id: generateId("docfolder"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...data,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeDocumentFolders([...readDocumentFolders(), folder]);
  recordTimelineActivity(folder.workspace_id, "document_folder", folder.id, "document_folder_created", `Folder created: "${folder.name}"`);

  return ok(folder);
}

/** Updates name/description/sort_order/visibility only — owner_type/owner_id never change after creation, and parent_folder_id changes only through moveDocumentFolder (so cycle/cross-owner checks stay in one place). */
async function updateDocumentFolder(
  id: string,
  input: { name: string; description: string | null; sort_order: number; visibility: DocumentVisibility },
): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (input.name.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { name: "Folder name is required." });
  }

  const updated: DocumentFolder = { ...existing, ...input, updated_at: nowIso() };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(
    existing.workspace_id,
    "document_folder",
    id,
    "document_folder_renamed",
    `Folder updated: "${updated.name}"`,
  );

  return ok(updated);
}

async function moveDocumentFolder(id: string, newParentFolderId: string | null): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }

  const check = canMoveFolder(existing, newParentFolderId, readDocumentFolders());
  if (!check.allowed) {
    return fail(check.reason ?? "This move is not allowed.");
  }

  const updated: DocumentFolder = { ...existing, parent_folder_id: newParentFolderId, updated_at: nowIso() };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "document_folder", id, "document_folder_moved", "Folder moved");

  return ok(updated);
}

async function archiveDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (existing.archived_at !== null) {
    return fail("This folder is already archived.");
  }

  const timestamp = nowIso();
  const updated: DocumentFolder = { ...existing, archived_at: timestamp, updated_at: timestamp };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "document_folder", id, "document_folder_archived", "Folder archived");

  return ok(updated);
}

async function restoreDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  const existing = readDocumentFolders().find((f) => f.id === id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (existing.archived_at === null) {
    return fail("This folder is not archived.");
  }

  const updated: DocumentFolder = { ...existing, archived_at: null, updated_at: nowIso() };
  writeDocumentFolders(readDocumentFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "document_folder", id, "document_folder_restored", "Folder restored");

  return ok(updated);
}

function buildFolderTree(parentFolderId: string | null, allFolders: DocumentFolder[]): DocumentFolderTreeNode[] {
  return getFolderChildren(parentFolderId, allFolders).map((folder) => ({
    folder,
    children: buildFolderTree(folder.id, allFolders),
  }));
}

async function getDocumentFolderTree(ownerType: EntityType, ownerId: string): Promise<DocumentFolderTreeNode[]> {
  await delay(150);
  const ownerFolders = readDocumentFolders().filter((f) => f.owner_type === ownerType && f.owner_id === ownerId);
  return buildFolderTree(null, ownerFolders);
}

async function getDocumentFolderPath(id: string): Promise<DocumentFolder[]> {
  await delay(100);
  return getFolderPath(id, readDocumentFolders());
}

/**
 * Applies a reusable folder-name template (see modules/documents/constants/
 * folderTemplates.ts) to one owner as a single atomic batch, optionally
 * nested under an existing folder. Mirrors applyDefaultChecklistTemplate:
 * every item is validated first (if any fails, nothing is written), the
 * whole batch is written in one call, and exactly one summarized
 * `document_folder_template_applied` Timeline entry is recorded — never
 * one per generated folder.
 */
async function applyDefaultFolderTemplate(input: {
  ownerType: EntityType;
  ownerId: string;
  templateKind: FolderTemplateKind;
  parentFolderId?: string | null;
}): Promise<DataResult<DocumentFolder[]>> {
  const parentFolderId = input.parentFolderId ?? null;
  const names = DOCUMENT_FOLDER_TEMPLATES[input.templateKind];

  const parsedItems: DocumentFolderInput[] = [];
  for (const [index, name] of names.entries()) {
    const parsed = documentFolderInputSchema.safeParse({
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      parent_folder_id: parentFolderId,
      name,
      description: null,
      sort_order: index,
      visibility: "internal",
    });
    if (!parsed.success) {
      return fail("The default folder template failed validation; no folders were created.", fieldErrorsFromZod(parsed.error));
    }
    parsedItems.push(parsed.data);
  }

  const timestamp = nowIso();
  const newFolders: DocumentFolder[] = parsedItems.map((data) => ({
    id: generateId("docfolder"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...data,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  }));

  writeDocumentFolders([...readDocumentFolders(), ...newFolders]);
  recordTimelineActivity(
    CURRENT_WORKSPACE_ID,
    input.ownerType,
    input.ownerId,
    "document_folder_template_applied",
    `Default ${input.templateKind} folder template applied with ${newFolders.length} folder${newFolders.length === 1 ? "" : "s"}.`,
  );

  return ok(newFolders);
}

// ---------------------------------------------------------------------------
// Document / Document Folder Notes and Timeline
// ---------------------------------------------------------------------------

async function getNotesByDocumentId(documentId: string): Promise<Note[]> {
  const document = readDocuments().find((d) => d.id === documentId);
  if (!document) return [];
  return getNotesByOwner(document.workspace_id, "document", documentId);
}

async function createDocumentNote(documentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const document = readDocuments().find((d) => d.id === documentId);
  if (!document) {
    return fail("Document not found.");
  }
  return createNoteForOwner(document.workspace_id, "document", documentId, input);
}

async function togglePinDocumentNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "document");
  if (!existing) return null;

  const updated: Note = { ...existing, is_pinned: !existing.is_pinned, updated_at: nowIso() };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "document",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByDocumentId(documentId: string): Promise<TimelineActivity[]> {
  const document = readDocuments().find((d) => d.id === documentId);
  if (!document) return [];
  return getTimelineByOwner(document.workspace_id, "document", documentId);
}

async function getNotesByDocumentFolderId(folderId: string): Promise<Note[]> {
  const folder = readDocumentFolders().find((f) => f.id === folderId);
  if (!folder) return [];
  return getNotesByOwner(folder.workspace_id, "document_folder", folderId);
}

async function createDocumentFolderNote(folderId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const folder = readDocumentFolders().find((f) => f.id === folderId);
  if (!folder) {
    return fail("Folder not found.");
  }
  return createNoteForOwner(folder.workspace_id, "document_folder", folderId, input);
}

async function togglePinDocumentFolderNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "document_folder");
  if (!existing) return null;

  const updated: Note = { ...existing, is_pinned: !existing.is_pinned, updated_at: nowIso() };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "document_folder",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByDocumentFolderId(folderId: string): Promise<TimelineActivity[]> {
  const folder = readDocumentFolders().find((f) => f.id === folderId);
  if (!folder) return [];
  return getTimelineByOwner(folder.workspace_id, "document_folder", folderId);
}

export const mockDocumentsRepository: DocumentsRepository = {
  getDocuments,
  getDocumentById,
  createDocumentMetadata,
  updateDocumentMetadata,
  activateDocument,
  createDocumentVersion,
  archiveDocument,
  restoreDocument,
  softDeleteDocument,
  expireDocument,
  updateDocumentVisibility,
  moveDocumentToFolder,
  getDocumentVersions,
  getLatestDocumentVersion,
  getDocumentsByOwner,
  getDocumentsByCategory,
  getDocumentsByReference,
  getDocumentNextAction,
  getDocumentOwnerSummary,
  getWorkspaceDocumentSummary,
  attachDocumentToContractExhibit,
  attachDocumentToPayment,
  attachDocumentToExpense,
  attachDocumentToInvoice,
  attachDocumentToEvent,
  attachDocumentToClient,
  getDocumentFolders,
  getDocumentFolderById,
  createDocumentFolder,
  updateDocumentFolder,
  moveDocumentFolder,
  archiveDocumentFolder,
  restoreDocumentFolder,
  getDocumentFolderTree,
  getDocumentFolderPath,
  applyDefaultFolderTemplate,
  getNotesByDocumentId,
  createDocumentNote,
  togglePinDocumentNote,
  getTimelineByDocumentId,
  getNotesByDocumentFolderId,
  createDocumentFolderNote,
  togglePinDocumentFolderNote,
  getTimelineByDocumentFolderId,
};
