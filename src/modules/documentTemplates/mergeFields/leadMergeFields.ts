import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getLeadById } from "@/lib/data";
import type { MergeFieldDefinition } from "@/types/documentPlatform";

/**
 * The `"lead"` Merge Field domain (v2 Checkpoint 44) — a Lead's own
 * pre-conversion facts, resolved from `context.leadId`. Distinct from the
 * `"crm"` domain's own `client_*` fields, which resolve from
 * `context.clientId` (a Lead is not yet a Client) — a document generated
 * for a prospect (a First Contact email, a proposal-preparation guide)
 * needs this domain; a document generated after conversion needs `"crm"`.
 */
export const leadMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "lead_name", label: "Lead Name", description: "The Lead's own full name.", domain: "lead", valueType: "string", required: false },
  { key: "lead_email", label: "Lead Email", description: "The Lead's own email address.", domain: "lead", valueType: "string", required: false },
  { key: "lead_source", label: "Lead Source", description: "How this Lead was acquired.", domain: "lead", valueType: "string", required: false },
  { key: "lead_event_type", label: "Lead Event Type", description: "The kind of event this Lead is inquiring about.", domain: "lead", valueType: "string", required: false },
];

export function registerLeadMergeFields(): void {
  for (const definition of leadMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("lead_name", async (context) => {
    if (!context.leadId) return null;
    const lead = await getLeadById(context.leadId).catch(() => null);
    return lead ? `${lead.first_name} ${lead.last_name}` : null;
  });

  registerMergeResolver("lead_email", async (context) => {
    if (!context.leadId) return null;
    const lead = await getLeadById(context.leadId).catch(() => null);
    return lead?.email ?? null;
  });

  registerMergeResolver("lead_source", async (context) => {
    if (!context.leadId) return null;
    const lead = await getLeadById(context.leadId).catch(() => null);
    return lead?.source ?? null;
  });

  registerMergeResolver("lead_event_type", async (context) => {
    if (!context.leadId) return null;
    const lead = await getLeadById(context.leadId).catch(() => null);
    return lead?.event_type ?? null;
  });
}
