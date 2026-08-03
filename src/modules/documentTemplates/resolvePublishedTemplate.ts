import { getDocumentsManager } from "@/core/documents/manager";
import type { Template } from "@/types/documentPlatform";

/**
 * The one lookup every "Generate X Document" Automation Action shares
 * (Step 13/14): the most recently published Template of a given document
 * type, for a given Workspace. `listTemplates()` already sorts newest
 * `updatedAt` first, so this is a simple `find` — a Workspace picks which
 * Template a Workflow trigger uses by publishing it, never by threading a
 * `templateId` through the trigger's own facts.
 */
export async function resolvePublishedTemplate(workspaceId: string, documentTypeId: string): Promise<Template | null> {
  const templates = await getDocumentsManager().listTemplates(workspaceId);
  return templates.find((template) => template.documentTypeId === documentTypeId && template.status === "published") ?? null;
}

/** Extracts the entity ids a `MergeContext` needs from an Automation trigger's own flat `facts` record — every key is read only if present and string-typed, never coerced. */
export function mergeContextEntityIdsFromFacts(facts: Record<string, string | number | boolean | null>): {
  clientId?: string;
  leadId?: string;
  eventId?: string;
  invoiceId?: string;
  contractId?: string;
} {
  const pick = (key: string): string | undefined => (typeof facts[key] === "string" ? (facts[key] as string) : undefined);
  return {
    clientId: pick("clientId"),
    leadId: pick("leadId"),
    eventId: pick("eventId"),
    invoiceId: pick("invoiceId"),
    contractId: pick("contractId"),
  };
}
