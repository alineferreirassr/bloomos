"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { getDocumentType } from "@/core/documents/documentTypeRegistry";
import { registerDocumentTypes } from "@/modules/documentTemplates/registerDocumentTypes";
import type { ComposedDocument, ComposedDocumentVersion, DocumentTypeDefinition, Template } from "@/types/documentPlatform";

const GENERIC_ACCESS_ERROR = "This Document isn't available. It may not exist, or you may not have access to it.";

registerDocumentTypes();

export interface ComposedDocumentViewData {
  document: ComposedDocument;
  template: Template | null;
  documentType: DocumentTypeDefinition | null;
  versions: ComposedDocumentVersion[];
  canPublish: boolean;
}

export type GetComposedDocumentViewDataResult = { success: true; data: ComposedDocumentViewData } | { success: false; error: string };

/** The Document viewer's own one-call aggregate — the compiled Document, its own source Template/document type (for context), and its full immutable Version History. */
export async function getComposedDocumentViewData(documentId: string): Promise<GetComposedDocumentViewDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getDocumentsManager();
  const document = await manager.getComposedDocumentById(documentId);
  if (!document || document.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  const [template, versions] = await Promise.all([manager.getTemplateById(document.templateId), manager.getDocumentVersions(documentId)]);

  return {
    success: true,
    data: {
      document,
      template,
      documentType: getDocumentType(document.documentTypeId) ?? null,
      versions,
      canPublish: session.permissions.includes("documents.create"),
    },
  };
}
