import type { Client } from "@/types/client";
import type { Event } from "@/types/event";
import type { ClientAccount } from "@/types/clientAccount";

/**
 * Checkpoint 16 — the Public API's own redaction policy: strip any field
 * a type's own doc comment already marks "internal-only" or "never expose"
 * (`types/client.ts`'s own "internal-only; never expose to a future Client
 * Portal" block, `types/event.ts`'s own `internal_summary`). A third-party
 * integration is at least as external as the Client Portal, so the same
 * boundary applies here — most domains (Invoices, Payments, Proposals,
 * Documents, Workflows) have no such marker and are returned as read
 * internally, unchanged; only Client and Event need an explicit allow-list.
 */

export interface ApiClient {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  instagram: string | null;
  preferred_contact_method: Client["preferred_contact_method"];
  partner_name: string | null;
  relationship_status: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  source: string | null;
  tags: string[];
  status: Client["internal_status"];
  is_returning: boolean;
  is_vip: boolean;
  wedding_date: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export function toApiClient(client: Client): ApiClient {
  return {
    id: client.id,
    first_name: client.first_name,
    last_name: client.last_name,
    email: client.email,
    phone: client.phone,
    instagram: client.instagram,
    preferred_contact_method: client.preferred_contact_method,
    partner_name: client.partner_name,
    relationship_status: client.relationship_status,
    address: client.address,
    city: client.city,
    state: client.state,
    zip_code: client.zip_code,
    source: client.source,
    tags: client.tags,
    status: client.internal_status,
    is_returning: client.is_returning,
    is_vip: client.is_vip,
    wedding_date: client.wedding_date,
    created_at: client.created_at,
    updated_at: client.updated_at,
    archived_at: client.archived_at,
  };
}

export interface ApiEvent {
  id: string;
  client_id: string;
  title: string;
  event_type: Event["event_type"];
  status: Event["status"];
  lifecycle_stage: Event["lifecycle_stage"];
  event_date: string | null;
  start_time: string | null;
  end_time: string | null;
  timezone: string | null;
  location_name: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  guest_count: number | null;
  budget_min: number | null;
  budget_max: number | null;
  package_name: string | null;
  theme: string | null;
  color_palette: string | null;
  priority: Event["priority"];
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

/** Excludes `internal_summary` (its own name says internal-only) and `confidentiality_notes`/`surprise_event` (defeats the point of a surprise if a third-party integration can read it) — every other operational field a logistics/reporting integration would legitimately need stays. */
export function toApiEvent(event: Event): ApiEvent {
  return {
    id: event.id,
    client_id: event.client_id,
    title: event.title,
    event_type: event.event_type,
    status: event.status,
    lifecycle_stage: event.lifecycle_stage,
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time,
    timezone: event.timezone,
    location_name: event.location_name,
    address: event.address,
    city: event.city,
    state: event.state,
    zip_code: event.zip_code,
    guest_count: event.guest_count,
    budget_min: event.budget_min,
    budget_max: event.budget_max,
    package_name: event.package_name,
    theme: event.theme,
    color_palette: event.color_palette,
    priority: event.priority,
    created_at: event.created_at,
    updated_at: event.updated_at,
    archived_at: event.archived_at,
    completed_at: event.completed_at,
    cancelled_at: event.cancelled_at,
  };
}

export interface ApiPortalUser {
  id: string;
  client_id: string;
  email: string;
  status: ClientAccount["status"];
  invited_by: string;
  accepted_at: string | null;
  suspended_at: string | null;
  revoked_at: string | null;
  last_access_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Excludes `auth_user_id` — a raw Supabase Auth identifier with no operational meaning to a third-party integration, and the kind of internal linkage id this API's own field-redaction policy exists to keep out even without a pre-existing "internal-only" doc marker. */
export function toApiPortalUser(account: ClientAccount): ApiPortalUser {
  return {
    id: account.id,
    client_id: account.client_id,
    email: account.email,
    status: account.status,
    invited_by: account.invited_by,
    accepted_at: account.accepted_at,
    suspended_at: account.suspended_at,
    revoked_at: account.revoked_at,
    last_access_at: account.last_access_at,
    created_at: account.created_at,
    updated_at: account.updated_at,
  };
}
