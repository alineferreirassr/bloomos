import type {
  CreateComposedDocumentInput,
  CreateDocumentBundleInput,
  CreateTemplateInput,
  DocumentsRepository,
  RecordDocumentVersionInput,
  UpdateTemplateDraftInput,
} from "@/lib/data/core/documents/repository";
import type {
  ComposedDocument,
  ComposedDocumentVersion,
  DocumentBundle,
  DocumentBundleItemKind,
  DocumentBundleStatus,
  Template,
} from "@/types/documentPlatform";
import { generateId, nowIso } from "@/lib/data/utils";
import { ok, fail, type DataResult } from "@/lib/data/result";

let templates: Template[] = [];
let documents: ComposedDocument[] = [];
let versions: ComposedDocumentVersion[] = [];
let bundles: DocumentBundle[] = [];

/** Test-only: restore every store to empty between test cases. */
export function resetDocumentsStore(): void {
  templates = [];
  documents = [];
  versions = [];
  bundles = [];
}

async function createTemplate(workspaceId: string, createdBy: string, input: CreateTemplateInput): Promise<DataResult<Template>> {
  const now = nowIso();
  const template: Template = {
    id: generateId("template"),
    workspaceId,
    documentTypeId: input.documentTypeId,
    name: input.name,
    description: input.description,
    status: "draft",
    content: input.content,
    header: input.header,
    footer: input.footer,
    variables: input.variables,
    version: 0,
    requiredPermissions: input.requiredPermissions,
    featureFlag: input.featureFlag,
    minimumRole: input.minimumRole,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  templates = [...templates, template];
  return ok(template);
}

async function getTemplateById(id: string): Promise<Template | null> {
  return templates.find((template) => template.id === id) ?? null;
}

async function listTemplates(workspaceId: string): Promise<Template[]> {
  return templates.filter((template) => template.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function updateTemplateDraft(id: string, input: UpdateTemplateDraftInput): Promise<DataResult<Template>> {
  const existing = templates.find((template) => template.id === id);
  if (!existing) return fail("Template not found.");
  if (existing.status === "archived") return fail("An archived Template cannot be edited — unarchive it first.");

  const updated: Template = {
    ...existing,
    name: input.name ?? existing.name,
    description: input.description ?? existing.description,
    content: input.content ?? existing.content,
    header: input.header ?? existing.header,
    footer: input.footer ?? existing.footer,
    variables: input.variables ?? existing.variables,
    updatedAt: nowIso(),
  };
  templates = templates.map((template) => (template.id === id ? updated : template));
  return ok(updated);
}

async function publishTemplate(id: string): Promise<DataResult<Template>> {
  const existing = templates.find((template) => template.id === id);
  if (!existing) return fail("Template not found.");
  if (existing.status === "archived") return fail("An archived Template cannot be published — unarchive it first.");
  const updated: Template = { ...existing, status: "published", version: existing.version + 1, updatedAt: nowIso() };
  templates = templates.map((template) => (template.id === id ? updated : template));
  return ok(updated);
}

async function archiveTemplate(id: string): Promise<DataResult<Template>> {
  const existing = templates.find((template) => template.id === id);
  if (!existing) return fail("Template not found.");
  const updated: Template = { ...existing, status: "archived", updatedAt: nowIso() };
  templates = templates.map((template) => (template.id === id ? updated : template));
  return ok(updated);
}

async function unarchiveTemplate(id: string): Promise<DataResult<Template>> {
  const existing = templates.find((template) => template.id === id);
  if (!existing) return fail("Template not found.");
  if (existing.status !== "archived") return fail("Only an archived Template can be unarchived.");
  const updated: Template = { ...existing, status: existing.version > 0 ? "published" : "draft", updatedAt: nowIso() };
  templates = templates.map((template) => (template.id === id ? updated : template));
  return ok(updated);
}

async function duplicateTemplate(id: string, createdBy: string): Promise<DataResult<Template>> {
  const source = templates.find((template) => template.id === id);
  if (!source) return fail("Template not found.");
  const now = nowIso();
  const duplicated: Template = {
    ...source,
    id: generateId("template"),
    name: `${source.name} (Copy)`,
    status: "draft",
    version: 0,
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  templates = [...templates, duplicated];
  return ok(duplicated);
}

async function createComposedDocument(workspaceId: string, input: CreateComposedDocumentInput): Promise<DataResult<ComposedDocument>> {
  const now = nowIso();
  const document: ComposedDocument = {
    id: generateId("document"),
    workspaceId,
    templateId: input.templateId,
    documentTypeId: input.documentTypeId,
    status: "draft",
    content: input.content,
    mergeContext: input.mergeContext,
    metadata: input.metadata,
    currentVersion: 0,
    createdBy: input.createdBy,
    createdAt: now,
    updatedAt: now,
  };
  documents = [...documents, document];
  return ok(document);
}

async function getComposedDocumentById(id: string): Promise<ComposedDocument | null> {
  return documents.find((document) => document.id === id) ?? null;
}

async function listComposedDocuments(workspaceId: string): Promise<ComposedDocument[]> {
  return documents.filter((document) => document.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function archiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>> {
  const existing = documents.find((document) => document.id === id);
  if (!existing) return fail("Document not found.");
  const updated: ComposedDocument = { ...existing, status: "archived", updatedAt: nowIso() };
  documents = documents.map((document) => (document.id === id ? updated : document));
  return ok(updated);
}

async function unarchiveComposedDocument(id: string): Promise<DataResult<ComposedDocument>> {
  const existing = documents.find((document) => document.id === id);
  if (!existing) return fail("Document not found.");
  if (existing.status !== "archived") return fail("Only an archived Document can be unarchived.");
  const updated: ComposedDocument = { ...existing, status: existing.currentVersion > 0 ? "published" : "draft", updatedAt: nowIso() };
  documents = documents.map((document) => (document.id === id ? updated : document));
  return ok(updated);
}

async function duplicateComposedDocument(id: string, createdBy: string): Promise<DataResult<ComposedDocument>> {
  const source = documents.find((document) => document.id === id);
  if (!source) return fail("Document not found.");
  const now = nowIso();
  const duplicated: ComposedDocument = {
    ...source,
    id: generateId("document"),
    status: "draft",
    currentVersion: 0,
    metadata: { ...source.metadata, title: `${source.metadata.title} (Copy)` },
    createdBy,
    createdAt: now,
    updatedAt: now,
  };
  documents = [...documents, duplicated];
  return ok(duplicated);
}

async function recordDocumentVersion(documentId: string, input: RecordDocumentVersionInput): Promise<DataResult<ComposedDocumentVersion>> {
  const existing = documents.find((document) => document.id === documentId);
  if (!existing) return fail("Document not found.");

  const nextVersionNumber = existing.currentVersion + 1;
  const version: ComposedDocumentVersion = {
    id: generateId("document_version"),
    documentId,
    version: nextVersionNumber,
    content: input.content,
    metadata: input.metadata,
    compiledBy: input.compiledBy,
    compiledAt: nowIso(),
    label: input.label,
  };
  versions = [...versions, version];

  const updatedDocument: ComposedDocument = { ...existing, status: "published", currentVersion: nextVersionNumber, updatedAt: nowIso() };
  documents = documents.map((document) => (document.id === documentId ? updatedDocument : document));

  return ok(version);
}

async function getDocumentVersions(documentId: string): Promise<ComposedDocumentVersion[]> {
  return versions.filter((version) => version.documentId === documentId).sort((a, b) => b.version - a.version);
}

async function getDocumentVersion(documentId: string, version: number): Promise<ComposedDocumentVersion | null> {
  return versions.find((entry) => entry.documentId === documentId && entry.version === version) ?? null;
}

async function restoreDocumentVersion(documentId: string, version: number): Promise<DataResult<ComposedDocument>> {
  const existing = documents.find((document) => document.id === documentId);
  if (!existing) return fail("Document not found.");
  const target = versions.find((entry) => entry.documentId === documentId && entry.version === version);
  if (!target) return fail("That Document version doesn't exist.");

  const updated: ComposedDocument = { ...existing, content: target.content, metadata: target.metadata, updatedAt: nowIso() };
  documents = documents.map((document) => (document.id === documentId ? updated : document));
  return ok(updated);
}

const BUNDLE_STATUS_ORDER: DocumentBundleStatus[] = ["draft", "ready", "sent", "viewed"];

async function createDocumentBundle(workspaceId: string, createdBy: string, input: CreateDocumentBundleInput): Promise<DataResult<DocumentBundle>> {
  const now = nowIso();
  const bundle: DocumentBundle = {
    id: generateId("bundle"),
    workspaceId,
    clientId: input.clientId,
    eventId: input.eventId,
    title: input.title,
    description: input.description,
    status: "draft",
    items: [],
    createdBy,
    createdAt: now,
    updatedAt: now,
    sentAt: null,
  };
  bundles = [...bundles, bundle];
  return ok(bundle);
}

async function getDocumentBundleById(id: string): Promise<DocumentBundle | null> {
  return bundles.find((bundle) => bundle.id === id) ?? null;
}

async function listDocumentBundlesForWorkspace(workspaceId: string): Promise<DocumentBundle[]> {
  return bundles.filter((bundle) => bundle.workspaceId === workspaceId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function listDocumentBundlesForClient(workspaceId: string, clientId: string): Promise<DocumentBundle[]> {
  return bundles
    .filter((bundle) => bundle.workspaceId === workspaceId && bundle.clientId === clientId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

async function addDocumentBundleItem(bundleId: string, kind: DocumentBundleItemKind, refId: string): Promise<DataResult<DocumentBundle>> {
  const existing = bundles.find((bundle) => bundle.id === bundleId);
  if (!existing) return fail("Bundle not found.");
  if (existing.items.some((item) => item.kind === kind && item.refId === refId)) return fail("That item is already in this Bundle.");

  const updated: DocumentBundle = {
    ...existing,
    items: [...existing.items, { id: generateId("bundle_item"), kind, refId, addedAt: nowIso() }],
    updatedAt: nowIso(),
  };
  bundles = bundles.map((bundle) => (bundle.id === bundleId ? updated : bundle));
  return ok(updated);
}

async function removeDocumentBundleItem(bundleId: string, itemId: string): Promise<DataResult<DocumentBundle>> {
  const existing = bundles.find((bundle) => bundle.id === bundleId);
  if (!existing) return fail("Bundle not found.");
  if (!existing.items.some((item) => item.id === itemId)) return fail("That item isn't in this Bundle.");

  const updated: DocumentBundle = { ...existing, items: existing.items.filter((item) => item.id !== itemId), updatedAt: nowIso() };
  bundles = bundles.map((bundle) => (bundle.id === bundleId ? updated : bundle));
  return ok(updated);
}

async function updateDocumentBundleStatus(bundleId: string, status: DocumentBundleStatus): Promise<DataResult<DocumentBundle>> {
  const existing = bundles.find((bundle) => bundle.id === bundleId);
  if (!existing) return fail("Bundle not found.");

  const currentIndex = BUNDLE_STATUS_ORDER.indexOf(existing.status);
  const nextIndex = BUNDLE_STATUS_ORDER.indexOf(status);
  if (nextIndex <= currentIndex) return fail(`A Bundle's status can only move forward — it is already "${existing.status}".`);

  const updated: DocumentBundle = { ...existing, status, sentAt: status === "sent" ? nowIso() : existing.sentAt, updatedAt: nowIso() };
  bundles = bundles.map((bundle) => (bundle.id === bundleId ? updated : bundle));
  return ok(updated);
}

export const mockDocumentsRepository: DocumentsRepository = {
  createTemplate,
  getTemplateById,
  listTemplates,
  updateTemplateDraft,
  publishTemplate,
  archiveTemplate,
  unarchiveTemplate,
  duplicateTemplate,
  createComposedDocument,
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
