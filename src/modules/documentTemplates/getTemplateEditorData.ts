"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { getDocumentType } from "@/core/documents/documentTypeRegistry";
import { listMergeFields } from "@/core/documents/mergeFieldRegistry";
import { registerDocumentTypes } from "@/modules/documentTemplates/registerDocumentTypes";
import { registerMergeFields } from "@/modules/documentTemplates/registerMergeFields";
import type { DocumentTypeDefinition, MergeFieldDefinition, Template } from "@/types/documentPlatform";

const GENERIC_ACCESS_ERROR = "This Template isn't available. It may not exist, or you may not have access to it.";

registerDocumentTypes();
registerMergeFields();

export interface TemplateEditorData {
  template: Template;
  documentType: DocumentTypeDefinition | null;
  mergeFields: MergeFieldDefinition[];
  canPublish: boolean;
}

export type GetTemplateEditorDataResult = { success: true; data: TemplateEditorData } | { success: false; error: string };

/**
 * The Template Editor's own one-call aggregate — the Template itself, its
 * own document type (for the header/breadcrumb), and the full Merge Field
 * catalog (for the Variables Panel) — mirroring `getWorkflowEditorData.ts`'s
 * own "Workflow + Node Catalog" shape almost exactly.
 */
export async function getTemplateEditorData(templateId: string): Promise<GetTemplateEditorDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const template = await getDocumentsManager().getTemplateById(templateId);
  if (!template || template.workspaceId !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };

  return {
    success: true,
    data: {
      template,
      documentType: getDocumentType(template.documentTypeId) ?? null,
      mergeFields: listMergeFields(),
      canPublish: session.permissions.includes("documents.create"),
    },
  };
}
