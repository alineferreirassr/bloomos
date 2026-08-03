"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import type { UpdateTemplateDraftInput } from "@/lib/data/core/documents/repository";

export type UpdateTemplateDraftActionResult = { success: true } | { success: false; error: string };

/** The Editor's own autosave path — updates a Template's mutable draft fields; refuses to write to a Template outside the caller's own Workspace. */
export async function updateTemplateDraftAction(templateId: string, input: UpdateTemplateDraftInput): Promise<UpdateTemplateDraftActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in to edit a Template." };

  const existing = await getDocumentsManager().getTemplateById(templateId);
  if (!existing || existing.workspaceId !== session.workspace.id) return { success: false, error: "Template not found." };

  const result = await getDocumentsManager().updateTemplateDraft(templateId, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}
