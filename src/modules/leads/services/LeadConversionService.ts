import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import { readLeads, writeLeads } from "@/lib/data/mock/leadsStore";
import { readClients, writeClients } from "@/lib/data/mock/clientsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";

/**
 * Owns the Lead -> Client conversion business rule end to end. UI never
 * implements this itself — pages/components only call convertLeadToClient
 * (re-exported from lib/data/index.ts, the single data-access surface).
 *
 * Responsibilities:
 * - validation and duplicate-conversion prevention
 * - Client record creation from the Lead's info
 * - Lead status update + linking the resulting client_id
 * - preserving the Lead's existing notes and timeline untouched (only one
 *   new timeline entry is appended, via the centralized recordTimelineActivity)
 */
export async function convertLeadToClient(
  leadId: string,
): Promise<DataResult<{ lead: Lead; client: Client }>> {
  const existing = readLeads().find((lead) => lead.id === leadId);
  if (!existing) {
    return fail("Lead not found.");
  }
  if (existing.status === "converted" || existing.converted_client_id) {
    return fail("This lead has already been converted to a Client.");
  }

  const timestamp = nowIso();
  const client: Client = {
    id: generateId("client"),
    workspace_id: existing.workspace_id,
    first_name: existing.first_name,
    last_name: existing.last_name,
    email: existing.email,
    phone: existing.phone,
    origin_lead_id: existing.id,
    is_returning: false,
    created_at: timestamp,
    updated_at: timestamp,
  };
  writeClients([...readClients(), client]);

  const updatedLead: Lead = {
    ...existing,
    status: "converted",
    converted_client_id: client.id,
    updated_at: timestamp,
  };
  writeLeads(readLeads().map((lead) => (lead.id === leadId ? updatedLead : lead)));

  recordTimelineActivity(leadId, "lead_converted", "Lead converted to Client", {
    client_id: client.id,
  });

  return ok({ lead: updatedLead, client });
}

export const LeadConversionService = { convertLeadToClient };
