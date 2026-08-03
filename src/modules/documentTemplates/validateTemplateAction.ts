"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { compileTemplate } from "@/core/documents/compiler";
import type { DocumentIssue, MergeContext } from "@/types/documentPlatform";

export type ValidateTemplateActionResult = { success: true; issues: DocumentIssue[] } | { success: false; error: string };

/**
 * The Editor's own Validation Panel — runs a real compile pass against a
 * synthetic, record-less `MergeContext` (workspace + acting member only,
 * no Client/Event/Invoice/Contract), so an author can check a Template's
 * own structure (unresolved/unknown fields, formatting, permission gates)
 * without needing a real record on hand. Never persists a Document —
 * `success: true` here means "no *structural* issues found," not "this is
 * ready to generate for a real record" (a `required` field with no
 * fallback still surfaces as `missing_variable` in this pass, correctly,
 * since nothing in a record-less context can resolve it).
 */
export async function validateTemplateAction(templateId: string): Promise<ValidateTemplateActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in to validate a Template." };

  const template = await getDocumentsManager().getTemplateById(templateId);
  if (!template || template.workspaceId !== session.workspace.id) return { success: false, error: "Template not found." };

  const context: MergeContext = { workspaceId: session.workspace.id, memberId: session.membership.id };
  const result = await compileTemplate(template, context, { permissions: session.permissions, role: session.membership.role });
  if (result.success) return { success: true, issues: [] };
  return { success: true, issues: result.issues };
}
