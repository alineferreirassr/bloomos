"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { getDocumentType } from "@/core/documents/documentTypeRegistry";
import { getDocumentSuggestions } from "@/core/documents/suggestions";
import { registerDocumentTypes } from "@/modules/documentTemplates/registerDocumentTypes";
import type { DocumentSuggestion } from "@/types/documentPlatform";

registerDocumentTypes();

export type GetDocumentSuggestionsActionResult = { success: true; suggestions: DocumentSuggestion[] } | { success: false; error: string };

/** Step 10's own Bloom AI Integration, surfaced to the Editor — deterministic suggestions only, never applied without an explicit human "Apply" action. */
export async function getDocumentSuggestionsAction(templateId: string): Promise<GetDocumentSuggestionsActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in." };

  const template = await getDocumentsManager().getTemplateById(templateId);
  if (!template || template.workspaceId !== session.workspace.id) return { success: false, error: "Template not found." };

  const documentType = getDocumentType(template.documentTypeId) ?? null;
  return { success: true, suggestions: getDocumentSuggestions(template, documentType) };
}
