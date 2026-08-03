import { getDocumentsManager } from "@/core/documents/manager";
import type { MergeContext } from "@/types/documentPlatform";
import type { AutomationActionDefinition, AutomationActionParams, AutomationActionResultDetail } from "@/types/automation";

export const GENERATE_DOCUMENT_ACTION_ID = "generate-document";

/**
 * v2.0 Checkpoint 39 — the generic counterpart to Checkpoint 12's 5
 * hardcoded "Generate X Document" Actions (`generateDocumentActionFactory.ts`):
 * this one takes any real, published Template id from the trigger's own
 * facts instead of one baked in at registration time. Calls
 * `getDocumentsManager().compileAndCreateDocument()` directly — the same
 * method `compileDocumentAction()`'s own "use server" wrapper calls after
 * its own `resolveMemberSessionSnapshot()` — using the trigger context's
 * own `workspaceId`/`userId`/`role`/`permissions` instead of a live request
 * session.
 */
const generateDocumentAction: AutomationActionDefinition = {
  id: GENERATE_DOCUMENT_ACTION_ID,
  name: "Generate Document",
  description: "Compiles a real, published Document Template into a new Document.",
  category: "general",
  version: "automation-action-generate-document-v1",
  requiredPermissions: [],
  featureFlag: null,
  minimumRole: null,
  async execute(params: AutomationActionParams): Promise<AutomationActionResultDetail> {
    const templateId = params.facts.templateId;
    if (typeof templateId !== "string") {
      return { success: false, message: "Missing templateId in the trigger's own facts." };
    }

    const context: MergeContext = {
      workspaceId: params.workspaceId,
      memberId: params.userId ?? "system",
      clientId: typeof params.facts.clientId === "string" ? params.facts.clientId : undefined,
      eventId: typeof params.facts.eventId === "string" ? params.facts.eventId : undefined,
      invoiceId: typeof params.facts.invoiceId === "string" ? params.facts.invoiceId : undefined,
      contractId: typeof params.facts.contractId === "string" ? params.facts.contractId : undefined,
    };

    const result = await getDocumentsManager().compileAndCreateDocument(templateId, context, { permissions: params.permissions, role: params.role });
    if (!result.success) return { success: false, message: result.issues.map((issue) => issue.message).join(" ") };
    return { success: true, message: `Document "${result.document.metadata.title}" generated.`, resultRef: { type: "document", id: result.document.id } };
  },
};

export default generateDocumentAction;
