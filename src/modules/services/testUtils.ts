import type { Service } from "@/types/service";
import type { ServiceVersion } from "@/types/serviceVersion";
import type { ServiceCategory } from "@/types/serviceCategory";
import type { EventService } from "@/types/eventService";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { ServiceCatalogRow, ServiceHealthSummary } from "@/lib/queries/services/types";

/** Test-only fixture factory — not imported by any app code. */
export function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "service_1",
    workspace_id: "workspace_1",
    category_id: "cat_1",
    name: "Live Music",
    description: null,
    status: "active",
    draft_version_id: "draft_1",
    current_published_version_id: "published_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeServiceVersion(overrides: Partial<ServiceVersion> = {}): ServiceVersion {
  return {
    id: "published_1",
    service_id: "service_1",
    workspace_id: "workspace_1",
    version_number: 1,
    status: "published",
    name_snapshot: "Live Music",
    description_snapshot: null,
    base_price_minor: 50000,
    currency: "USD",
    setup_duration_minutes: null,
    breakdown_duration_minutes: null,
    difficulty_score: null,
    experience_level_required: null,
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
    change_summary: null,
    published_at: "2026-01-01T00:00:00.000Z",
    published_by: "Amoré Bloom Owner",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeServiceCategory(overrides: Partial<ServiceCategory> = {}): ServiceCategory {
  return {
    id: "cat_1",
    workspace_id: "workspace_1",
    name: "Music",
    description: null,
    display_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeServiceHealthSummary(overrides: Partial<ServiceHealthSummary> = {}): ServiceHealthSummary {
  return { percent: 85, missing: [], ...overrides };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeEventService(overrides: Partial<EventService> = {}): EventService {
  return {
    id: "event_service_1",
    workspace_id: "workspace_1",
    event_id: "event_1",
    service_id: "service_1",
    service_version_id: "published_1",
    name: "Live Music",
    name_template_value: "Live Music",
    price_minor: 50000,
    price_template_value: 50000,
    currency: "USD",
    selected_add_on_ids: [],
    status: "confirmed",
    assigned_at: "2026-01-05T00:00:00.000Z",
    assigned_by: "Amoré Bloom Owner",
    created_at: "2026-01-05T00:00:00.000Z",
    updated_at: "2026-01-05T00:00:00.000Z",
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "event_1",
    workspace_id: "workspace_1",
    client_id: "client_1",
    originating_lead_id: null,
    title: "Amelia & Noah's Wedding",
    event_type: "micro_wedding",
    status: "confirmed",
    lifecycle_stage: "planning",
    event_date: "2026-06-15",
    start_time: null,
    end_time: null,
    timezone: null,
    location_name: null,
    address: null,
    city: null,
    state: null,
    zip_code: null,
    latitude: null,
    longitude: null,
    guest_count: null,
    budget_min: null,
    budget_max: null,
    package_name: null,
    theme: null,
    color_palette: null,
    surprise_event: false,
    confidentiality_notes: null,
    accessibility_notes: null,
    dietary_notes: null,
    weather_plan: null,
    backup_location: null,
    internal_summary: null,
    assigned_owner: null,
    priority: "normal",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    completed_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeClient(overrides: Partial<Client> = {}): Client {
  return {
    id: "client_1",
    workspace_id: "workspace_1",
    originating_lead_id: null,
    first_name: "Amelia",
    last_name: "Carter",
    email: "amelia@example.com",
    phone: null,
    instagram: null,
    preferred_contact_method: null,
    partner_name: null,
    relationship_status: null,
    important_dates: [],
    address: null,
    city: null,
    state: null,
    zip_code: null,
    source: null,
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
    favorite_restaurants: null,
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
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    pending_recovery: null,
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makeServiceCatalogRow(overrides: Partial<ServiceCatalogRow> = {}): ServiceCatalogRow {
  return {
    service: makeService(),
    categoryName: "Music",
    draftVersion: makeServiceVersion({ id: "draft_1", status: "draft", version_number: null, name_snapshot: null, published_at: null, published_by: null }),
    publishedVersion: makeServiceVersion(),
    health: makeServiceHealthSummary(),
    usageCount: 3,
    ...overrides,
  };
}
