import type { LeadStatus } from "@/core/enums/leadStatus";

/**
 * Field names mirror docs/database.md and the approved Leads spec verbatim
 * (snake_case) rather than being translated to camelCase — there's no
 * Supabase mapping layer yet, so a translation layer would be pure overhead.
 */
export interface Lead {
  id: string;
  workspace_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  source: string;
  event_type: string | null;
  event_date: string | null;
  location: string | null;
  budget_min: number | null;
  budget_max: number | null;
  message: string | null;
  status: LeadStatus;
  assigned_to: string | null;
  /** Not in the original required-fields list, but necessary to satisfy the
   *  conversion requirements (store the resulting client_id, prevent
   *  duplicate conversion). */
  converted_client_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
