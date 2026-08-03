"use server";

import { resolveMemberSessionSnapshot, type MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { publishWebhookEvent } from "@/core/webhooks/publisher";
import type { ComposedDocument } from "@/types/documentPlatform";

type LifecycleActionResult = { success: true } | { success: false; error: string };
type DuplicateActionResult = { success: true; documentId: string } | { success: false; error: string };
type OwnedDocumentGate = { success: true; session: Extract<MemberSessionSnapshot, { kind: "active" }>; document: ComposedDocument } | { success: false; error: string };

const ELEVATED_PERMISSION = "documents.create";

async function requireOwnedDocument(documentId: string): Promise<OwnedDocumentGate> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in." };
  if (!session.permissions.includes(ELEVATED_PERMISSION)) return { success: false, error: "You don't have permission to manage Documents." };
  const document = await getDocumentsManager().getComposedDocumentById(documentId);
  if (!document || document.workspaceId !== session.workspace.id) return { success: false, error: "Document not found." };
  return { success: true, session, document };
}

/** Publishing a new Version, archiving, unarchiving, restoring, and duplicating a compiled Document — grouped in one file since each is a thin, identically-gated wrapper over `DocumentsManager`. */
export async function publishDocumentVersionAction(documentId: string, label: string | null): Promise<LifecycleActionResult> {
  const gate = await requireOwnedDocument(documentId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().recordDocumentVersion(documentId, {
    content: gate.document.content,
    metadata: gate.document.metadata,
    compiledBy: gate.session.user.id,
    label,
  });
  if (!result.success) return { success: false, error: result.error };

  publishWebhookEvent({
    type: "document.published",
    workspaceId: gate.session.workspace.id,
    resource: { type: "document", id: documentId },
    payload: { id: documentId, version: result.data.version, compiledAt: result.data.compiledAt, label: result.data.label },
  });
  return { success: true };
}

export async function archiveDocumentAction(documentId: string): Promise<LifecycleActionResult> {
  const gate = await requireOwnedDocument(documentId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().archiveComposedDocument(documentId);
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function unarchiveDocumentAction(documentId: string): Promise<LifecycleActionResult> {
  const gate = await requireOwnedDocument(documentId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().unarchiveComposedDocument(documentId);
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function restoreDocumentVersionAction(documentId: string, version: number): Promise<LifecycleActionResult> {
  const gate = await requireOwnedDocument(documentId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().restoreDocumentVersion(documentId, version);
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function duplicateDocumentAction(documentId: string): Promise<DuplicateActionResult> {
  const gate = await requireOwnedDocument(documentId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().duplicateComposedDocument(documentId, gate.session.user.id);
  return result.success ? { success: true, documentId: result.data.id } : { success: false, error: result.error };
}
