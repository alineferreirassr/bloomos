import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { EntityType } from "@/core/enums/entityType";
import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentStatus } from "@/core/enums/documentStatus";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import type { DocumentMetadataInput, NewDocumentVersionInput, DocumentFolderInput } from "@/modules/documents/schema";
import type { NoteFormInput } from "@/modules/notes/schema";
import type { DataResult } from "@/lib/data/result";
import type { DocumentOwnerSummary, DocumentWorkspaceSummary } from "@/modules/documents/documentStats";
import type { FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";

export type DocumentReferenceType =
  | "contract_exhibit"
  | "event"
  | "client"
  | "contract"
  | "invoice"
  | "payment"
  | "expense";

export interface DocumentFilters {
  search?: string;
  ownerType?: EntityType | "all";
  ownerId?: string;
  category?: DocumentCategory | "all";
  status?: DocumentStatus | "all";
  visibility?: DocumentVisibility | "all";
  mimeType?: string;
  extension?: string;
  folderId?: string | null;
  uploadedFrom?: string;
  uploadedTo?: string;
  expiresFrom?: string;
  expiresTo?: string;
  includeArchived?: boolean;
  includeDeleted?: boolean;
  latestVersionOnly?: boolean;
  referenceType?: DocumentReferenceType;
  referenceId?: string;
  sortBy?: "title" | "uploaded_at" | "updated_at" | "size_bytes" | "expires_at" | "version";
  sortDirection?: "asc" | "desc";
}

export interface DocumentFolderFilters {
  ownerType?: EntityType;
  ownerId?: string;
  parentFolderId?: string | null;
  includeArchived?: boolean;
}

export interface DocumentFolderTreeNode {
  folder: DocumentFolder;
  children: DocumentFolderTreeNode[];
}

/** Metadata-only update — file content is attached/changed via `media_asset_id`, folder via moveDocumentToFolder, status/visibility each have their own dedicated action. */
export interface DocumentMetadataUpdateInput {
  title: string | null;
  description: string | null;
  category: DocumentCategory;
  expires_at: string | null;
  /** Optional: links (or clears, if explicitly null) this Document version's MediaAsset. Undefined leaves the existing link untouched. */
  media_asset_id?: string | null;
}

/**
 * The single Documents persistence contract — implemented once by the mock
 * repository (lib/data/documents/mockRepository.ts) and once by the
 * Supabase repository (lib/data/documents/supabaseRepository.ts), exactly
 * mirroring the Leads/Clients/Events/Contracts/Finance repository pattern.
 * lib/data/index.ts picks between them via lib/data/provider.ts's
 * selectRepository().
 *
 * Bundles Documents, Document Folders, Document/Folder Notes/Timeline, and
 * the 6 attachDocumentTo* reference helpers into one repository pair —
 * same rationale as every other bundled repository: Folders need the
 * owning Document's workspace_id, Notes/Timeline need both owner types.
 *
 * A Document is business metadata only. The physical file is a MediaAsset
 * (see lib/data/media/repository.ts), linked via `media_asset_id` — this
 * repository never validates file extension/MIME/size/checksum itself,
 * that's the Media Library's job. See src/types/document.ts for the full
 * architecture note.
 */
export interface DocumentsRepository {
  getDocuments(filters?: DocumentFilters): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document>;
  createDocumentMetadata(input: DocumentMetadataInput): Promise<DataResult<Document>>;
  updateDocumentMetadata(id: string, input: DocumentMetadataUpdateInput): Promise<DataResult<Document>>;
  activateDocument(id: string): Promise<DataResult<Document>>;
  createDocumentVersion(input: NewDocumentVersionInput): Promise<DataResult<Document>>;
  archiveDocument(id: string): Promise<DataResult<Document>>;
  restoreDocument(id: string): Promise<DataResult<Document>>;
  softDeleteDocument(id: string): Promise<DataResult<Document>>;
  expireDocument(id: string): Promise<DataResult<Document>>;
  updateDocumentVisibility(id: string, visibility: DocumentVisibility): Promise<DataResult<Document>>;
  moveDocumentToFolder(id: string, folderId: string | null): Promise<DataResult<Document>>;
  getDocumentVersions(documentId: string): Promise<Document[]>;
  getLatestDocumentVersion(documentId: string): Promise<Document>;
  getDocumentsByOwner(ownerType: EntityType, ownerId: string): Promise<Document[]>;
  getDocumentsByCategory(category: DocumentCategory): Promise<Document[]>;
  getDocumentsByReference(referenceType: DocumentReferenceType, referenceId: string): Promise<Document[]>;
  getDocumentNextAction(documentId: string): Promise<string | null>;
  getDocumentOwnerSummary(ownerType: EntityType, ownerId: string): Promise<DocumentOwnerSummary>;
  getWorkspaceDocumentSummary(): Promise<DocumentWorkspaceSummary>;

  attachDocumentToContractExhibit(documentId: string, exhibitId: string): Promise<DataResult<Document>>;
  attachDocumentToPayment(documentId: string, paymentId: string): Promise<DataResult<Document>>;
  attachDocumentToExpense(documentId: string, expenseId: string): Promise<DataResult<Document>>;
  attachDocumentToInvoice(documentId: string, invoiceId: string): Promise<DataResult<Document>>;
  attachDocumentToEvent(documentId: string, eventId: string): Promise<DataResult<Document>>;
  attachDocumentToClient(documentId: string, clientId: string): Promise<DataResult<Document>>;

  getDocumentFolders(filters?: DocumentFolderFilters): Promise<DocumentFolder[]>;
  getDocumentFolderById(id: string): Promise<DocumentFolder>;
  createDocumentFolder(input: DocumentFolderInput): Promise<DataResult<DocumentFolder>>;
  updateDocumentFolder(
    id: string,
    input: { name: string; description: string | null; sort_order: number; visibility: DocumentVisibility },
  ): Promise<DataResult<DocumentFolder>>;
  moveDocumentFolder(id: string, newParentFolderId: string | null): Promise<DataResult<DocumentFolder>>;
  archiveDocumentFolder(id: string): Promise<DataResult<DocumentFolder>>;
  restoreDocumentFolder(id: string): Promise<DataResult<DocumentFolder>>;
  getDocumentFolderTree(ownerType: EntityType, ownerId: string): Promise<DocumentFolderTreeNode[]>;
  getDocumentFolderPath(id: string): Promise<DocumentFolder[]>;
  applyDefaultFolderTemplate(input: {
    ownerType: EntityType;
    ownerId: string;
    templateKind: FolderTemplateKind;
    parentFolderId?: string | null;
  }): Promise<DataResult<DocumentFolder[]>>;

  getNotesByDocumentId(documentId: string): Promise<Note[]>;
  createDocumentNote(documentId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  /** Same null-fallthrough contract as togglePinContractNote/togglePinInvoiceNote — null means "not a Document-owned note." */
  togglePinDocumentNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByDocumentId(documentId: string): Promise<TimelineActivity[]>;

  getNotesByDocumentFolderId(folderId: string): Promise<Note[]>;
  createDocumentFolderNote(folderId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  togglePinDocumentFolderNote(noteId: string): Promise<DataResult<Note> | null>;
  getTimelineByDocumentFolderId(folderId: string): Promise<TimelineActivity[]>;
}
