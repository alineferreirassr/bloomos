"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import type { UpdateTemplateDraftInput } from "@/lib/data/core/documents/repository";

export type UpdateTemplateDraftActionResult = { success: true } | { success: false; error: string };

/**
 * The same elevated permission `templateLifecycleActions.ts`'s
 * `requireOwnedTemplate` checks for publish/archive/unarchive/duplicate —
 * autosave is a mutation of a Template's real content and must not be a
 * weaker gate than those siblings just because it fires implicitly.
 */
const ELEVATED_PERMISSION = "documents.create";

/**
 * The Editor's own autosave path — updates a Template's mutable draft
 * fields; refuses to write to a Template outside the caller's own Workspace,
 * and refuses a caller who only holds `documents.view` (a viewer must not be
 * able to mutate a Template merely by having the Editor route open — this
 * check exists independent of that route's own guard, since the route guard
 * alone is not authorization for a direct action invocation).
 */
export async function updateTemplateDraftAction(templateId: string, input: UpdateTemplateDraftInput): Promise<UpdateTemplateDraftActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in to edit a Template." };
  if (!session.permissions.includes(ELEVATED_PERMISSION)) return { success: false, error: "You don't have permission to manage Templates." };

  const existing = await getDocumentsManager().getTemplateById(templateId);
  if (!existing || existing.workspaceId !== session.workspace.id) return { success: false, error: "Template not found." };

  const result = await getDocumentsManager().updateTemplateDraft(templateId, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true };
}
