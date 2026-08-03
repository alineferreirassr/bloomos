import { mockDocumentsRepository } from "@/lib/data/core/documents/mockRepository";
import type {
  CreateComposedDocumentInput,
  CreateDocumentBundleInput,
  CreateTemplateInput,
  DocumentsRepository,
  RecordDocumentVersionInput,
  UpdateTemplateDraftInput,
} from "@/lib/data/core/documents/repository";
import { compileTemplate, type CompilePermissionContext } from "@/core/documents/compiler";
import { getLogger } from "@/core/observability/logger";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import type {
  ComposedDocument,
  ComposedDocumentVersion,
  DocumentBundle,
  DocumentBundleItemKind,
  DocumentBundleStatus,
  DocumentCompileResult,
  MergeContext,
  Template,
} from "@/types/documentPlatform";
import type { DataResult } from "@/lib/data/result";

/**
 * The one place every caller reads or writes Document Storage — sitting
 * directly on the Knowledge Store (`lib/data/core/documents/`), the same
 * "Manager sits on a Store" shape `core/workflow/manager.ts`/
 * `core/settings/manager.ts` already established. Also the "Version
 * Manager" from the architecture diagram: `compileAndCreateDocument` is
 * the one function that bridges the Compiler's own output into a real,
 * persisted `ComposedDocument`. Logs safe, structural fields only —
 * `templateId`/`documentId`/`status`/`version`/issue codes — **never** a
 * block tree's own text (Step 17's own "Never log document contents").
 */
export function getDocumentsManager(): DocumentsManager {
  return documentsManager;
}

export interface DocumentsManager {
  createTemplate(workspaceId: string, createdBy: string, input: CreateTemplateInput): Promise<DataResult<Template>>;
  getTemplateById(id: string): Promise<Template | null>;
  listTemplates(workspaceId: string): Promise<Template[]>;
  updateTemplateDraft(id: string, input: UpdateTemplateDraftInput): Promise<DataResult<Template>>;
  publishTemplate(id: string): Promise<DataResult<Template>>;
  archiveTemplate(id: string): Promise<DataResult<Template>>;
  unarchiveTemplate(id: string): Promise<DataResult<Template>>;
  duplicateTemplate(id: string, createdBy: string): Promise<DataResult<Template>>;

  /** Compiles `templateId` against `context` and, only on success, persists a new draft `ComposedDocument` — the Compiler → Version Manager → Storage pipeline made concrete. Never partially persists: a failed compile writes nothing. */
  compileAndCreateDocument(templateId: string, context: MergeContext, permissionContext: CompilePermissionContext): Promise<DocumentCompileResult>;
  getComposedDocumentById(id: string): Promise<ComposedDocument | null>;
  listComposedDocuments(workspaceId: string): Promise<ComposedDocument[]>;
  archiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>>;
  unarchiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>>;
  duplicateComposedDocument(id: string, createdBy: string): Promise<DataResult<ComposedDocument>>;
  recordDocumentVersion(documentId: string, input: RecordDocumentVersionInput): Promise<DataResult<ComposedDocumentVersion>>;
  getDocumentVersions(documentId: string): Promise<ComposedDocumentVersion[]>;
  getDocumentVersion(documentId: string, version: number): Promise<ComposedDocumentVersion | null>;
  restoreDocumentVersion(documentId: string, version: number): Promise<DataResult<ComposedDocument>>;

  createDocumentBundle(workspaceId: string, createdBy: string, input: CreateDocumentBundleInput): Promise<DataResult<DocumentBundle>>;
  getDocumentBundleById(id: string): Promise<DocumentBundle | null>;
  listDocumentBundlesForWorkspace(workspaceId: string): Promise<DocumentBundle[]>;
  listDocumentBundlesForClient(workspaceId: string, clientId: string): Promise<DocumentBundle[]>;
  addDocumentBundleItem(bundleId: string, kind: DocumentBundleItemKind, refId: string): Promise<DataResult<DocumentBundle>>;
  removeDocumentBundleItem(bundleId: string, itemId: string): Promise<DataResult<DocumentBundle>>;
  updateDocumentBundleStatus(bundleId: string, status: DocumentBundleStatus): Promise<DataResult<DocumentBundle>>;
}

function knowledgeStore(): DocumentsRepository {
  return mockDocumentsRepository;
}

async function createTemplate(workspaceId: string, createdBy: string, input: CreateTemplateInput): Promise<DataResult<Template>> {
  const result = await knowledgeStore().createTemplate(workspaceId, createdBy, input);
  if (result.success) getLogger().info("Template created", { workspaceId, templateId: result.data.id, documentTypeId: result.data.documentTypeId });
  return result;
}

async function getTemplateById(id: string): Promise<Template | null> {
  return knowledgeStore().getTemplateById(id);
}

async function listTemplates(workspaceId: string): Promise<Template[]> {
  return knowledgeStore().listTemplates(workspaceId);
}

async function updateTemplateDraft(id: string, input: UpdateTemplateDraftInput): Promise<DataResult<Template>> {
  return knowledgeStore().updateTemplateDraft(id, input);
}

async function publishTemplate(id: string): Promise<DataResult<Template>> {
  const result = await knowledgeStore().publishTemplate(id);
  if (result.success) {
    getLogger().info("Template published", { templateId: id, version: result.data.version });
    publishWebhookEvent({
      type: "template.published",
      workspaceId: result.data.workspaceId,
      resource: { type: "template", id: result.data.id },
      payload: { id: result.data.id, name: result.data.name, documentTypeId: result.data.documentTypeId, updatedAt: result.data.updatedAt },
    });
  }
  return result;
}

async function archiveTemplate(id: string): Promise<DataResult<Template>> {
  const result = await knowledgeStore().archiveTemplate(id);
  if (result.success) getLogger().info("Template archived", { templateId: id });
  return result;
}

async function unarchiveTemplate(id: string): Promise<DataResult<Template>> {
  return knowledgeStore().unarchiveTemplate(id);
}

async function duplicateTemplate(id: string, createdBy: string): Promise<DataResult<Template>> {
  const result = await knowledgeStore().duplicateTemplate(id, createdBy);
  if (result.success) getLogger().info("Template duplicated", { sourceTemplateId: id, templateId: result.data.id });
  return result;
}

async function compileAndCreateDocument(templateId: string, context: MergeContext, permissionContext: CompilePermissionContext): Promise<DocumentCompileResult> {
  const template = await knowledgeStore().getTemplateById(templateId);
  if (!template) {
    getLogger().warn("Document compile failed — unknown template", { templateId });
    return { success: false, issues: [{ code: "unknown_template", target: templateId, message: "This Template no longer exists." }] };
  }

  const result = await compileTemplate(template, context, permissionContext);
  if (!result.success) {
    getLogger().warn("Document compile blocked by validation", { templateId, issueCount: result.issues.length, issueCodes: result.issues.map((issue) => issue.code) });
    return { success: false, issues: result.issues };
  }

  getLogger().info("Document compiled", { templateId, workspaceId: context.workspaceId });

  const createInput: CreateComposedDocumentInput = {
    templateId,
    documentTypeId: template.documentTypeId,
    content: result.compiled.content,
    mergeContext: context,
    metadata: {
      title: template.name,
      description: template.description,
      tags: [],
      clientName: typeof result.compiled.scope.client_name === "string" ? result.compiled.scope.client_name : null,
      eventTitle: typeof result.compiled.scope.event_title === "string" ? result.compiled.scope.event_title : null,
    },
    createdBy: context.memberId,
  };

  const created = await knowledgeStore().createComposedDocument(context.workspaceId, createInput);
  if (!created.success) {
    return { success: false, issues: [{ code: "unknown_template", target: templateId, message: created.error }] };
  }

  getLogger().info("Document created", { documentId: created.data.id, templateId, workspaceId: context.workspaceId });
  publishWebhookEvent({
    type: "document.generated",
    workspaceId: context.workspaceId,
    resource: { type: "document", id: created.data.id },
    payload: { id: created.data.id, templateId: created.data.templateId, documentTypeId: created.data.documentTypeId, status: created.data.status, currentVersion: created.data.currentVersion, createdAt: created.data.createdAt },
  });
  return { success: true, document: created.data };
}

async function getComposedDocumentById(id: string): Promise<ComposedDocument | null> {
  return knowledgeStore().getComposedDocumentById(id);
}

async function listComposedDocuments(workspaceId: string): Promise<ComposedDocument[]> {
  return knowledgeStore().listComposedDocuments(workspaceId);
}

async function archiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>> {
  const result = await knowledgeStore().archiveComposedDocument(id);
  if (result.success) getLogger().info("Document archived", { documentId: id });
  return result;
}

async function unarchiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>> {
  return knowledgeStore().unarchiveComposedDocument(id);
}

async function duplicateComposedDocument(id: string, createdBy: string): Promise<DataResult<ComposedDocument>> {
  const result = await knowledgeStore().duplicateComposedDocument(id, createdBy);
  if (result.success) getLogger().info("Document duplicated", { sourceDocumentId: id, documentId: result.data.id });
  return result;
}

async function recordDocumentVersion(documentId: string, input: RecordDocumentVersionInput): Promise<DataResult<ComposedDocumentVersion>> {
  const result = await knowledgeStore().recordDocumentVersion(documentId, input);
  if (result.success) getLogger().info("Document published", { documentId, version: result.data.version });
  return result;
}

async function getDocumentVersions(documentId: string): Promise<ComposedDocumentVersion[]> {
  return knowledgeStore().getDocumentVersions(documentId);
}

async function getDocumentVersion(documentId: string, version: number): Promise<ComposedDocumentVersion | null> {
  return knowledgeStore().getDocumentVersion(documentId, version);
}

async function restoreDocumentVersion(documentId: string, version: number): Promise<DataResult<ComposedDocument>> {
  const result = await knowledgeStore().restoreDocumentVersion(documentId, version);
  if (result.success) getLogger().info("Document restored", { documentId, restoredToVersion: version });
  return result;
}

async function createDocumentBundle(workspaceId: string, createdBy: string, input: CreateDocumentBundleInput): Promise<DataResult<DocumentBundle>> {
  const result = await knowledgeStore().createDocumentBundle(workspaceId, createdBy, input);
  if (result.success) {
    getLogger().info("Document bundle created", { workspaceId, bundleId: result.data.id, clientId: result.data.clientId });
    recordTimelineActivity(workspaceId, "document_bundle", result.data.id, "document_bundle_created", `Document bundle created: "${result.data.title}"`);
  }
  return result;
}

async function getDocumentBundleById(id: string): Promise<DocumentBundle | null> {
  return knowledgeStore().getDocumentBundleById(id);
}

async function listDocumentBundlesForWorkspace(workspaceId: string): Promise<DocumentBundle[]> {
  return knowledgeStore().listDocumentBundlesForWorkspace(workspaceId);
}

async function listDocumentBundlesForClient(workspaceId: string, clientId: string): Promise<DocumentBundle[]> {
  return knowledgeStore().listDocumentBundlesForClient(workspaceId, clientId);
}

async function addDocumentBundleItem(bundleId: string, kind: DocumentBundleItemKind, refId: string): Promise<DataResult<DocumentBundle>> {
  const result = await knowledgeStore().addDocumentBundleItem(bundleId, kind, refId);
  if (result.success) {
    getLogger().info("Document bundle item added", { bundleId, kind, refId });
    recordTimelineActivity(result.data.workspaceId, "document_bundle", bundleId, "document_bundle_item_added", `Item added to bundle: "${result.data.title}"`);
  }
  return result;
}

async function removeDocumentBundleItem(bundleId: string, itemId: string): Promise<DataResult<DocumentBundle>> {
  const result = await knowledgeStore().removeDocumentBundleItem(bundleId, itemId);
  if (result.success) {
    getLogger().info("Document bundle item removed", { bundleId, itemId });
    recordTimelineActivity(result.data.workspaceId, "document_bundle", bundleId, "document_bundle_item_removed", `Item removed from bundle: "${result.data.title}"`);
  }
  return result;
}

const DOCUMENT_BUNDLE_STATUS_TIMELINE_TYPES: Partial<Record<DocumentBundleStatus, "document_bundle_ready" | "document_bundle_sent" | "document_bundle_viewed">> = {
  ready: "document_bundle_ready",
  sent: "document_bundle_sent",
  viewed: "document_bundle_viewed",
};

async function updateDocumentBundleStatus(bundleId: string, status: DocumentBundleStatus): Promise<DataResult<DocumentBundle>> {
  const result = await knowledgeStore().updateDocumentBundleStatus(bundleId, status);
  if (result.success) {
    getLogger().info("Document bundle status updated", { bundleId, status });
    const timelineType = DOCUMENT_BUNDLE_STATUS_TIMELINE_TYPES[status];
    if (timelineType) recordTimelineActivity(result.data.workspaceId, "document_bundle", bundleId, timelineType, `Document bundle "${result.data.title}" marked ${status}`);
  }
  return result;
}

const documentsManager: DocumentsManager = {
  createTemplate,
  getTemplateById,
  listTemplates,
  updateTemplateDraft,
  publishTemplate,
  archiveTemplate,
  unarchiveTemplate,
  duplicateTemplate,
  compileAndCreateDocument,
  getComposedDocumentById,
  listComposedDocuments,
  archiveComposedDocument,
  unarchiveComposedDocument,
  duplicateComposedDocument,
  recordDocumentVersion,
  getDocumentVersions,
  getDocumentVersion,
  restoreDocumentVersion,
  createDocumentBundle,
  getDocumentBundleById,
  listDocumentBundlesForWorkspace,
  listDocumentBundlesForClient,
  addDocumentBundleItem,
  removeDocumentBundleItem,
  updateDocumentBundleStatus,
};
