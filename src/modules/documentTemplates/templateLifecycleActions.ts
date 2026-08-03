"use server";

import { resolveMemberSessionSnapshot, type MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import type { Template } from "@/types/documentPlatform";

type LifecycleActionResult = { success: true } | { success: false; error: string };
type DuplicateActionResult = { success: true; templateId: string } | { success: false; error: string };
type OwnedTemplateGate = { success: true; session: Extract<MemberSessionSnapshot, { kind: "active" }>; template: Template } | { success: false; error: string };

const ELEVATED_PERMISSION = "documents.create";

async function requireOwnedTemplate(templateId: string): Promise<OwnedTemplateGate> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: "You must be signed in." };
  if (!session.permissions.includes(ELEVATED_PERMISSION)) return { success: false, error: "You don't have permission to manage Templates." };
  const template = await getDocumentsManager().getTemplateById(templateId);
  if (!template || template.workspaceId !== session.workspace.id) return { success: false, error: "Template not found." };
  return { success: true, session, template };
}

/** Publishing, archiving, unarchiving, and duplicating a Template all require the same elevated `documents.create` permission — grouped in one file since each is a thin, identically-gated wrapper over `DocumentsManager`. */
export async function publishTemplateAction(templateId: string): Promise<LifecycleActionResult> {
  const gate = await requireOwnedTemplate(templateId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().publishTemplate(templateId);
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function archiveTemplateAction(templateId: string): Promise<LifecycleActionResult> {
  const gate = await requireOwnedTemplate(templateId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().archiveTemplate(templateId);
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function unarchiveTemplateAction(templateId: string): Promise<LifecycleActionResult> {
  const gate = await requireOwnedTemplate(templateId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().unarchiveTemplate(templateId);
  return result.success ? { success: true } : { success: false, error: result.error };
}

export async function duplicateTemplateAction(templateId: string): Promise<DuplicateActionResult> {
  const gate = await requireOwnedTemplate(templateId);
  if (!gate.success) return gate;
  const result = await getDocumentsManager().duplicateTemplate(templateId, gate.session.user.id);
  return result.success ? { success: true, templateId: result.data.id } : { success: false, error: result.error };
}
