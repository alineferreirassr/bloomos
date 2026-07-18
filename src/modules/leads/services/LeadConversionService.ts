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
 * - reuse an existing Client (same workspace, case/whitespace-insensitive
 *   email match) instead of ever inserting a duplicate — mirrors the
 *   Supabase `convert_lead_to_client` function exactly (see
 *   supabase/migrations/20260728100100_convert_lead_to_client_dedup.sql)
 * - Client record creation only when no existing Client matches
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
  if (existing.status === "archived") {
    return fail("Archived leads cannot be converted to a Client.");
  }
  if (existing.status === "converted" || existing.converted_client_id) {
    return fail("This lead has already been converted to a Client.");
  }

  const timestamp = nowIso();
  const normalizedEmail = existing.email.trim().toLowerCase();
  const existingClient = readClients().find(
    (c) => c.workspace_id === existing.workspace_id && c.email.trim().toLowerCase() === normalizedEmail,
  );

  let client: Client;
  if (existingClient) {
    client = {
      ...existingClient,
      originating_lead_id: existingClient.originating_lead_id ?? existing.id,
      updated_at: timestamp,
    };
    writeClients(readClients().map((c) => (c.id === existingClient.id ? client : c)));
  } else {
    client = {
      id: generateId("client"),
      workspace_id: existing.workspace_id,
      originating_lead_id: existing.id,
      first_name: existing.first_name,
      last_name: existing.last_name,
      email: existing.email,
      phone: existing.phone,
      instagram: existing.instagram,
      preferred_contact_method: null,
      partner_name: null,
      relationship_status: null,
      important_dates: [],
      address: null,
      city: null,
      state: null,
      zip_code: null,
      source: existing.source,
      tags: [],
      internal_status: "active",
      is_returning: false,

      how_they_met: null,
      first_date: null,
      relationship_anniversary: null,
      engagement_date: null,
      wedding_date: null,
      favorite_colors: null,
      favorite_flowers: null,
      favorite_music: null,
      favorite_food: null,
      favorite_drinks: null,
      preferred_style: null,
      disliked_elements: null,

      allergies: null,
      accessibility_needs: null,
      dietary_restrictions: null,
      preferred_communication_time: null,
      do_not_call: false,
      surprise_event_confidentiality: false,
      emergency_contact_name: null,
      emergency_contact_phone: null,
      is_vip: false,

      created_at: timestamp,
      updated_at: timestamp,
      archived_at: null,
      pending_recovery: null,
    };
    writeClients([...readClients(), client]);
  }

  const updatedLead: Lead = {
    ...existing,
    status: "converted",
    converted_client_id: client.id,
    updated_at: timestamp,
  };
  writeLeads(readLeads().map((lead) => (lead.id === leadId ? updatedLead : lead)));

  recordTimelineActivity(existing.workspace_id, "lead", leadId, "lead_converted", "Lead converted to Client", {
    client_id: client.id,
  });
  recordTimelineActivity(
    client.workspace_id,
    "client",
    client.id,
    existingClient ? "client_updated" : "client_created",
    existingClient ? "Converted Lead linked to existing Client" : "Client created from converted Lead",
    { originating_lead_id: existing.id, reused_existing_client: Boolean(existingClient) },
  );

  return ok({ lead: updatedLead, client });
}

export const LeadConversionService = { convertLeadToClient };
