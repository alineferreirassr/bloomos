import type { Lead } from "@/types/lead";
import type { Client } from "@/types/client";
import type { DataResult } from "@/lib/data/result";

/**
 * The Lead -> Client conversion contract — spans both the Leads and Clients
 * domains, so it lives in its own directory rather than under either one.
 * Implemented once by the mock repository (mockConversionRepository.ts,
 * a thin wrapper around the existing
 * modules/leads/services/LeadConversionService.ts, left completely
 * untouched) and once by the Supabase repository
 * (supabaseConversionRepository.ts, backed by the
 * convert_lead_to_client(uuid, text) Postgres function).
 */
export interface ConversionRepository {
  convertLeadToClient(leadId: string): Promise<DataResult<{ lead: Lead; client: Client }>>;
}
