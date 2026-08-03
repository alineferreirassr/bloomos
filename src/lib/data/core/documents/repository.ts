import type {
  ComposedDocument,
  ComposedDocumentMetadata,
  ComposedDocumentVersion,
  DocumentBlock,
  DocumentBundle,
  DocumentBundleItemKind,
  DocumentBundleStatus,
  MergeContext,
  Template,
  TemplateVariable,
} from "@/types/documentPlatform";
import type { Permission } from "@/core/enums/permission";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { DataResult } from "@/lib/data/result";

export interface CreateTemplateInput {
  documentTypeId: string;
  name: string;
  description: string;
  content: DocumentBlock[];
  header: DocumentBlock[];
  footer: DocumentBlock[];
  variables: TemplateVariable[];
  requiredPermissions: Permission[];
  featureFlag: string | null;
  minimumRole: WorkspaceMemberRole | null;
}

export interface UpdateTemplateDraftInput {
  name?: string;
  description?: string;
  content?: DocumentBlock[];
  header?: DocumentBlock[];
  footer?: DocumentBlock[];
  variables?: TemplateVariable[];
}

export interface CreateComposedDocumentInput {
  templateId: string;
  documentTypeId: string;
  content: DocumentBlock[];
  mergeContext: MergeContext;
  metadata: ComposedDocumentMetadata;
  createdBy: string;
}

export interface RecordDocumentVersionInput {
  content: DocumentBlock[];
  metadata: ComposedDocumentMetadata;
  compiledBy: string;
  label: string | null;
}

export interface CreateDocumentBundleInput {
  clientId: string | null;
  eventId: string | null;
  title: string;
  description: string;
}

/**
 * The Step 6/7 Document Storage contract. "Never overwrite published
 * versions" is enforced by this interface's own shape, not by convention —
 * mirrors `WorkflowRepository`'s own precedent exactly: there is no
 * `updateVersion`/`deleteVersion` method anywhere on it, a
 * `ComposedDocumentVersion` can only ever be created
 * (`recordDocumentVersion`). A `Template`'s own `content`/`header`/`footer`
 * stays freely editable even after `status` flips to `"published"` — the
 * same "a Workflow's own graph keeps drifting after publish" precedent —
 * because a `Template` carries no snapshot chain of its own: what a
 * `ComposedDocument` actually renders is frozen into *its own* `content`
 * the moment it's compiled, permanently unaffected by later Template
 * edits.
 */
export interface DocumentsRepository {
  createTemplate(workspaceId: string, createdBy: string, input: CreateTemplateInput): Promise<DataResult<Template>>;
  getTemplateById(id: string): Promise<Template | null>;
  listTemplates(workspaceId: string): Promise<Template[]>;
  updateTemplateDraft(id: string, input: UpdateTemplateDraftInput): Promise<DataResult<Template>>;
  /** Flips `status` to `"published"` and increments `version` — the Template becomes generatable from. */
  publishTemplate(id: string): Promise<DataResult<Template>>;
  archiveTemplate(id: string): Promise<DataResult<Template>>;
  unarchiveTemplate(id: string): Promise<DataResult<Template>>;
  /** Creates a brand-new Template (its own id, `status: "draft"`, `version: 1`) copying the source's current `content`/`header`/`footer`/`variables` — the source Template is untouched. */
  duplicateTemplate(id: string, createdBy: string): Promise<DataResult<Template>>;

  createComposedDocument(workspaceId: string, input: CreateComposedDocumentInput): Promise<DataResult<ComposedDocument>>;
  getComposedDocumentById(id: string): Promise<ComposedDocument | null>;
  listComposedDocuments(workspaceId: string): Promise<ComposedDocument[]>;
  archiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>>;
  unarchiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>>;
  /** Creates a brand-new Document (its own id, `status: "draft"`, `currentVersion: 0`) copying the source's current `content`/`metadata` — the source Document, and its own published versions, are untouched. */
  duplicateComposedDocument(id: string, createdBy: string): Promise<DataResult<ComposedDocument>>;
  /** Creates the next immutable `ComposedDocumentVersion` and flips the Document's own `status` to `"published"`/`currentVersion` forward. */
  recordDocumentVersion(documentId: string, input: RecordDocumentVersionInput): Promise<DataResult<ComposedDocumentVersion>>;
  getDocumentVersions(documentId: string): Promise<ComposedDocumentVersion[]>;
  getDocumentVersion(documentId: string, version: number): Promise<ComposedDocumentVersion | null>;
  /** Copies a prior version's own `content`/`metadata` back onto the Document's own current draft — a discard-current-edits operation. Never touches the `ComposedDocumentVersion` record itself, and never changes `status`/`currentVersion`. */
  restoreDocumentVersion(documentId: string, version: number): Promise<DataResult<ComposedDocument>>;

  /** v2 Checkpoint 44, Step 5 — Document Bundles, stored as a title/description plus an ordered list of by-reference items. Never stores a copy of a Proposal/Contract/Invoice/Document's own content. */
  createDocumentBundle(workspaceId: string, createdBy: string, input: CreateDocumentBundleInput): Promise<DataResult<DocumentBundle>>;
  getDocumentBundleById(id: string): Promise<DocumentBundle | null>;
  listDocumentBundlesForWorkspace(workspaceId: string): Promise<DocumentBundle[]>;
  listDocumentBundlesForClient(workspaceId: string, clientId: string): Promise<DocumentBundle[]>;
  /** Appends a new item referencing `refId` — rejects a duplicate `(kind, refId)` pair already in the Bundle. */
  addDocumentBundleItem(bundleId: string, kind: DocumentBundleItemKind, refId: string): Promise<DataResult<DocumentBundle>>;
  removeDocumentBundleItem(bundleId: string, itemId: string): Promise<DataResult<DocumentBundle>>;
  /** Enforces the Bundle's own forward-only status machine: draft -> ready -> sent -> viewed. */
  updateDocumentBundleStatus(bundleId: string, status: DocumentBundleStatus): Promise<DataResult<DocumentBundle>>;
}
