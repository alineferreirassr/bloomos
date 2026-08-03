"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import type { DocumentCompileResult, MergeContext } from "@/types/documentPlatform";

export interface CompileDocumentInput {
  templateId: string;
  clientId?: string;
  eventId?: string;
  invoiceId?: string;
  contractId?: string;
}

/**
 * Step 13's own "manual actions" path — a member explicitly compiling one
 * Document from the Editor or Template Library, as opposed to the
 * Automation Engine dispatching a "Generate X Document" Action. Both paths
 * converge on the exact same `DocumentsManager.compileAndCreateDocument()`
 * — this file adds no compile logic of its own, only session resolution.
 */
export async function compileDocumentAction(input: CompileDocumentInput): Promise<DocumentCompileResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") {
    return { success: false, issues: [{ code: "permission_denied", target: null, message: "You must be signed in to generate a Document." }] };
  }

  const context: MergeContext = {
    workspaceId: session.workspace.id,
    memberId: session.membership.id,
    clientId: input.clientId || undefined,
    eventId: input.eventId || undefined,
    invoiceId: input.invoiceId || undefined,
    contractId: input.contractId || undefined,
  };

  return getDocumentsManager().compileAndCreateDocument(input.templateId, context, { permissions: session.permissions, role: session.membership.role });
}
