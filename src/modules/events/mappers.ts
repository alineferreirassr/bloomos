import type { Event } from "@/types/event";
import type { EventFormInput } from "@/modules/events/schema";

/** Converts an Event record's null/numeric fields into the plain-string shape the form works with. */
export function eventToFormInput(event: Event): EventFormInput {
  return {
    client_id: event.client_id,
    originating_lead_id: event.originating_lead_id ?? "",
    title: event.title,
    event_type: event.event_type,
    event_date: event.event_date ?? "",
    start_time: event.start_time ?? "",
    end_time: event.end_time ?? "",
    timezone: event.timezone ?? "",
    location_name: event.location_name ?? "",
    address: event.address ?? "",
    city: event.city ?? "",
    state: event.state ?? "",
    zip_code: event.zip_code ?? "",
    latitude: event.latitude === null ? "" : String(event.latitude),
    longitude: event.longitude === null ? "" : String(event.longitude),
    guest_count: event.guest_count === null ? "" : String(event.guest_count),
    budget_min: event.budget_min === null ? "" : String(event.budget_min),
    budget_max: event.budget_max === null ? "" : String(event.budget_max),
    package_name: event.package_name ?? "",
    theme: event.theme ?? "",
    color_palette: event.color_palette ?? "",
    surprise_event: event.surprise_event,
    confidentiality_notes: event.confidentiality_notes ?? "",
    accessibility_notes: event.accessibility_notes ?? "",
    dietary_notes: event.dietary_notes ?? "",
    weather_plan: event.weather_plan ?? "",
    backup_location: event.backup_location ?? "",
    internal_summary: event.internal_summary ?? "",
    assigned_owner: event.assigned_owner ?? "",
    priority: event.priority,
  };
}
