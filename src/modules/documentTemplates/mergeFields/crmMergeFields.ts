import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getClientById, getEventById } from "@/lib/data";
import { getProposalsRepository } from "@/lib/data/proposals";
import type { MergeFieldDefinition, MergeValue } from "@/types/documentPlatform";

/**
 * The `"crm"` Merge Field domain (Step 4/11) — Client, Event, and Proposal
 * History, resolved from the real CRM data layer via `context.clientId`/
 * `context.eventId`. Every resolver here fails soft (returns `null`/`[]`
 * rather than throwing) when its own id is absent from the context or the
 * record no longer exists — a Document generated without a linked Client
 * (e.g. an internal Run Sheet) still compiles, it simply has no `client_*`
 * values to substitute (surfaced as `missing_variable` only for a Template
 * that actually references one as `required`).
 */
export const crmMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "client_name", label: "Client Name", description: "The primary Client's full name.", domain: "crm", valueType: "string", required: false },
  { key: "partner_name", label: "Partner Name", description: "The Client's partner, if recorded.", domain: "crm", valueType: "string", required: false },
  { key: "client_email", label: "Client Email", description: "The Client's own email address.", domain: "crm", valueType: "string", required: false },
  { key: "client_phone", label: "Client Phone", description: "The Client's own phone number.", domain: "crm", valueType: "string", required: false },
  { key: "client_address", label: "Client Address", description: "The Client's own mailing address.", domain: "crm", valueType: "string", required: false },
  { key: "event_title", label: "Event Title", description: "The linked Event's own title.", domain: "crm", valueType: "string", required: false },
  { key: "event_date", label: "Event Date", description: "The linked Event's own date.", domain: "crm", valueType: "date", required: false },
  { key: "event_location", label: "Event Location", description: "The linked Event's own location name.", domain: "crm", valueType: "string", required: false },
  { key: "client_risk_flags", label: "Client Risk Flags", description: "Real, recorded risk signals on the Client (Do Not Call, Inactive status).", domain: "crm", valueType: "list", required: false },
  { key: "client_proposal_history", label: "Proposal History", description: "Every Proposal generated for the linked Event, newest first.", domain: "crm", valueType: "list", required: false },
];

export function registerCrmMergeFields(): void {
  for (const definition of crmMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("client_name", async (context) => {
    if (!context.clientId) return null;
    const client = await getClientById(context.clientId).catch(() => null);
    return client ? `${client.first_name} ${client.last_name}` : null;
  });

  registerMergeResolver("partner_name", async (context) => {
    if (!context.clientId) return null;
    const client = await getClientById(context.clientId).catch(() => null);
    return client?.partner_name ?? null;
  });

  registerMergeResolver("client_email", async (context) => {
    if (!context.clientId) return null;
    const client = await getClientById(context.clientId).catch(() => null);
    return client?.email ?? null;
  });

  registerMergeResolver("client_phone", async (context) => {
    if (!context.clientId) return null;
    const client = await getClientById(context.clientId).catch(() => null);
    return client?.phone ?? null;
  });

  registerMergeResolver("client_address", async (context) => {
    if (!context.clientId) return null;
    const client = await getClientById(context.clientId).catch(() => null);
    if (!client) return null;
    const parts = [client.address, client.city, client.state, client.zip_code].filter((part): part is string => Boolean(part));
    return parts.length > 0 ? parts.join(", ") : null;
  });

  registerMergeResolver("event_title", async (context) => {
    if (!context.eventId) return null;
    const event = await getEventById(context.eventId).catch(() => null);
    return event?.title ?? null;
  });

  registerMergeResolver("event_date", async (context) => {
    if (!context.eventId) return null;
    const event = await getEventById(context.eventId).catch(() => null);
    return event?.event_date ?? null;
  });

  registerMergeResolver("event_location", async (context) => {
    if (!context.eventId) return null;
    const event = await getEventById(context.eventId).catch(() => null);
    return event?.location_name ?? null;
  });

  registerMergeResolver("client_risk_flags", async (context) => {
    if (!context.clientId) return [];
    const client = await getClientById(context.clientId).catch(() => null);
    if (!client) return [];
    const flags: MergeValue[] = [];
    if (client.do_not_call) flags.push("Do not call");
    if (client.internal_status === "inactive") flags.push("Inactive client");
    return flags;
  });

  registerMergeResolver("client_proposal_history", async (context) => {
    if (!context.eventId) return [];
    const proposals = await getProposalsRepository().getProposalsByEvent(context.eventId);
    return proposals
      .slice()
      .sort((a, b) => b.generated_at.localeCompare(a.generated_at))
      .map((proposal): MergeValue => ({ status: proposal.status, version: proposal.version, generated_at: proposal.generated_at }));
  });
}
