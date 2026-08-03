"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { getDocumentType } from "@/core/documents/documentTypeRegistry";
import { registerDocumentTypes } from "@/modules/documentTemplates/registerDocumentTypes";
import type { CreateTemplateInput } from "@/lib/data/core/documents/repository";

registerDocumentTypes();

export type CreateTemplateActionResult = { success: true; templateId: string } | { success: false; error: string };

/** Creates a brand-new draft Template of a real, registered document type — the one write path the Template Library's own "New Template" dialog uses. */
export async function createTemplateAction(documentTypeId: string, name: string, description: string): Promise<CreateTemplateActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in to create a Template." };

  const documentType = getDocumentType(documentTypeId);
  if (!documentType) return { success: false, error: "Unknown document type." };
  if (documentType.requiredPermissions.some((permission) => !session.permissions.includes(permission))) {
    return { success: false, error: "You don't have permission to create this document type." };
  }
  if (!name.trim()) return { success: false, error: "Name is required." };

  const input: CreateTemplateInput = {
    documentTypeId,
    name: name.trim(),
    description: description.trim(),
    content: [],
    header: [],
    footer: [],
    variables: [],
    requiredPermissions: documentType.requiredPermissions,
    featureFlag: documentType.featureFlag,
    minimumRole: documentType.minimumRole,
  };

  const result = await getDocumentsManager().createTemplate(session.workspace.id, session.user.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, templateId: result.data.id };
}
