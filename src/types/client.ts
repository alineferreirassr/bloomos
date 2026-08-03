import type { ClientStatus } from "@/core/enums/clientStatus";
import type { ContactMethod } from "@/core/enums/contactMethod";
import type { PendingRecovery } from "@/types/pendingRecovery";

/** A custom or milestone date the team wants to track for a Client. */
export interface ClientImportantDate {
  id: string;
  label: string;
  date: string;
}

/**
 * Field names mirror docs/database.md verbatim (snake_case) rather than being
 * translated to camelCase — there's no Supabase mapping layer yet, so a
 * translation layer would be pure overhead.
 */
export interface Client {
  id: string;
  workspace_id: string;
  originating_lead_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  preferred_contact_method: ContactMethod | null;
  partner_name: string | null;
  /** Curated free text (e.g. Dating, Engaged, Married) — see modules/clients/constants.ts; no canonical enum specified. */
  relationship_status: string | null;
  important_dates: ClientImportantDate[];
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  /** How they originally came in — curated options in modules/clients/constants.ts, not a canonical enum. */
  source: string | null;
  tags: string[];
  internal_status: ClientStatus;
  /** True once they have more than one Events record — becomes meaningful once Events exists. */
  is_returning: boolean;

  // Couple information
  how_they_met: string | null;
  first_date: string | null;
  relationship_anniversary: string | null;
  engagement_date: string | null;
  wedding_date: string | null;
  favorite_colors: string | null;
  favorite_flowers: string | null;
  favorite_music: string | null;
  favorite_food: string | null;
  favorite_drinks: string | null;
  favorite_restaurants: string | null;
  preferred_style: string | null;
  disliked_elements: string | null;

  // Important operational details — internal-only; never expose to a future Client Portal.
  allergies: string | null;
  accessibility_needs: string | null;
  dietary_restrictions: string | null;
  preferred_communication_time: string | null;
  do_not_call: boolean;
  surprise_event_confidentiality: boolean;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  is_vip: boolean;

  created_at: string;
  updated_at: string;
  archived_at: string | null;

  /** Set only while a multi-step workflow involving this Client is stuck partway through — see types/pendingRecovery.ts. */
  pending_recovery: PendingRecovery | null;
}
