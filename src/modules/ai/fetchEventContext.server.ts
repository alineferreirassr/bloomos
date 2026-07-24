import "server-only";
import { getDataMode } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapEventRow, mapClientRow, mapChecklistItemRow, mapEventScheduleItemRow } from "@/lib/supabase/mappers";
import { readEvents } from "@/lib/data/mock/eventsStore";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readChecklistItems } from "@/lib/data/mock/checklistStore";
import { readScheduleItems } from "@/lib/data/mock/scheduleStore";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";

export interface EventContextRecord {
  event: Event;
  client: Client | null;
  checklist: ChecklistItem[];
  schedule: EventScheduleItem[];
}

/** Mock mode has no multi-tenant concept (single simulated Workspace) — same "find by id in the flat store" shape `mockRepository.ts`'s own `getEventById` already uses. */
function fetchEventContextRecordMock(eventId: string): EventContextRecord | null {
  const event = readEvents().find((candidate) => candidate.id === eventId);
  if (!event) return null;

  return {
    event,
    client: readClients().find((candidate) => candidate.id === event.client_id) ?? null,
    checklist: readChecklistItems().filter((item) => item.owner_type === "event" && item.owner_id === eventId),
    schedule: readScheduleItems().filter((item) => item.owner_type === "event" && item.owner_id === eventId),
  };
}

/**
 * Minimal duplicate of the point-lookup shape `lib/data/events/supabaseRepository.ts`
 * already uses (`.eq("id", id).maybeSingle()`, RLS alone enforcing
 * Workspace isolation) — that repository is wired to the *browser* Supabase
 * client (`@/lib/supabase/client`) and can't be called from a Server
 * Action, so a `"use server"` AI action needs its own server-side read path
 * rather than a broader repository refactor this phase's scope rules out.
 * Returns `null` for "doesn't exist OR isn't visible to this session" — RLS
 * makes the two indistinguishable here, which is the safe default: a
 * cross-Workspace Event ID must never confirm its own existence.
 */
async function fetchEventContextRecordSupabase(eventId: string): Promise<EventContextRecord | null> {
  const supabase = await createClient();

  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("*")
    .eq("id", eventId)
    .maybeSingle();
  if (eventError) throw normalizeSupabaseError(eventError);
  if (!eventRow) return null;

  const event = mapEventRow(eventRow);

  const [clientResult, checklistResult, scheduleResult] = await Promise.all([
    supabase.from("clients").select("*").eq("id", event.client_id).maybeSingle(),
    supabase
      .from("checklist_items")
      .select("*")
      .eq("workspace_id", event.workspace_id)
      .eq("owner_type", "event")
      .eq("owner_id", eventId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("event_schedule_items")
      .select("*")
      .eq("workspace_id", event.workspace_id)
      .eq("owner_type", "event")
      .eq("owner_id", eventId)
      .order("sort_order", { ascending: true }),
  ]);

  if (clientResult.error) throw normalizeSupabaseError(clientResult.error);
  if (checklistResult.error) throw normalizeSupabaseError(checklistResult.error);
  if (scheduleResult.error) throw normalizeSupabaseError(scheduleResult.error);

  return {
    event,
    client: clientResult.data ? mapClientRow(clientResult.data) : null,
    checklist: (checklistResult.data ?? []).map(mapChecklistItemRow),
    schedule: (scheduleResult.data ?? []).map(mapEventScheduleItemRow),
  };
}

export async function fetchEventContextRecord(eventId: string): Promise<EventContextRecord | null> {
  if (getDataMode() !== "supabase") {
    return fetchEventContextRecordMock(eventId);
  }
  return fetchEventContextRecordSupabase(eventId);
}
