import { getDataMode } from "@/lib/env";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapEventServiceRow } from "@/lib/supabase/mappers";
import { readEventServices } from "@/lib/data/mock/eventServicesStore";
import type { EventService } from "@/types/eventService";
import type { AIContextBuilder } from "@/core/ai/context/types";

export interface EventServiceAssignmentContextItem {
  eventServiceId: string;
  label: string;
  priceMinor: number;
  currency: string;
}

/** `@/lib/supabase/server` is imported dynamically — see `clientContextBuilder.ts`'s identical doc comment for why. */
async function fetchEventServices(workspaceId: string, eventId: string): Promise<EventService[]> {
  if (getDataMode() !== "supabase") {
    return readEventServices().filter((service) => service.event_id === eventId && service.status !== "cancelled");
  }
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("event_services").select("*").eq("workspace_id", workspaceId).eq("event_id", eventId);
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapEventServiceRow).filter((service) => service.status !== "cancelled");
}

/**
 * The first real builder for the `eventServiceAssignment` section
 * Checkpoint 2 reserved — excludes cancelled assignments, since a
 * cancelled service was never part of what's actually being proposed (or
 * whatever a future feature needs "what's assigned to this Event" for).
 * Returns an empty array (not `null`) when the Event has assignments
 * fetched successfully but none survive the cancelled filter — `null` is
 * reserved for "no `eventId` was given", matching every other builder's
 * convention.
 */
export const eventServiceAssignmentContextBuilder: AIContextBuilder = {
  key: "eventServiceAssignment",
  priority: 6,
  async build({ workspaceId, refs }) {
    if (!refs.eventId) return null;
    const services = await fetchEventServices(workspaceId, refs.eventId);
    const data: EventServiceAssignmentContextItem[] = services.map((service) => ({
      eventServiceId: service.id,
      label: service.name,
      priceMinor: service.price_minor,
      currency: service.currency,
    }));
    return { data, source: "listEventServicesByEvent (excludes cancelled assignments)" };
  },
};
