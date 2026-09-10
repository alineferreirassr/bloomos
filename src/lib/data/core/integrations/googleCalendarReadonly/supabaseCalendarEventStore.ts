import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { GoogleCalendarEvent, GoogleCalendarEventAttendee, GoogleCalendarEventOrganizer } from "@/core/integrations/googleCalendarReadonly/types";

/** GCAL-04 — the real, durable counterpart to `calendarEventStore.ts`'s mock implementation. Uses the server-only, session-bound Supabase client — every read/write here runs as the calling user under RLS (`google_calendar_events_own_scope`), since this codebase never uses a service-role client. */
type EventRow = Database["public"]["Tables"]["google_calendar_events"]["Row"];

function mapRow(row: EventRow): GoogleCalendarEvent {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    calendar_id: row.calendar_id,
    provider_event_id: row.provider_event_id,
    i_cal_uid: row.i_cal_uid,
    recurring_event_id: row.recurring_event_id,
    original_start_time: row.original_start_time,
    summary: row.summary,
    description: row.description,
    location: row.location,
    status: row.status,
    all_day: row.all_day,
    start_date: row.start_date,
    end_date: row.end_date,
    start_date_time: row.start_date_time,
    end_date_time: row.end_date_time,
    time_zone: row.time_zone,
    organizer: row.organizer as GoogleCalendarEventOrganizer | null,
    attendees: (row.attendees ?? []) as unknown as GoogleCalendarEventAttendee[],
    html_link: row.html_link,
    hangout_link: row.hangout_link,
    cancelled_at: row.cancelled_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertEvent(event: GoogleCalendarEvent): Promise<GoogleCalendarEvent> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_events")
    .insert({
      id: event.id,
      workspace_id: event.workspace_id,
      member_id: event.member_id,
      calendar_id: event.calendar_id,
      provider_event_id: event.provider_event_id,
      i_cal_uid: event.i_cal_uid,
      recurring_event_id: event.recurring_event_id,
      original_start_time: event.original_start_time,
      summary: event.summary,
      description: event.description,
      location: event.location,
      status: event.status,
      all_day: event.all_day,
      start_date: event.start_date,
      end_date: event.end_date,
      start_date_time: event.start_date_time,
      end_date_time: event.end_date_time,
      time_zone: event.time_zone,
      organizer: event.organizer as unknown as Record<string, unknown> | null,
      attendees: event.attendees as unknown as Record<string, unknown>[],
      html_link: event.html_link,
      hangout_link: event.hangout_link,
      cancelled_at: event.cancelled_at,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getEventById(id: string): Promise<GoogleCalendarEvent | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendar_events").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getEventByProviderId(calendarId: string, providerEventId: string): Promise<GoogleCalendarEvent | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendar_events").select("*").eq("calendar_id", calendarId).eq("provider_event_id", providerEventId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listEventsForCalendar(calendarId: string): Promise<GoogleCalendarEvent[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendar_events").select("*").eq("calendar_id", calendarId).order("created_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

/**
 * GCAL-06 — bounded, active-only, range-overlap read for the Calendar
 * display source. `start_date`/`end_date` are plain `date` columns (no
 * time/zone component — a lexicographic `YYYY-MM-DD` comparison is
 * exact), while `start_date_time`/`end_date_time` are `timestamptz`
 * columns — Postgres compares those by true absolute instant regardless
 * of what UTC offset the original Google value carried, so a plain
 * `.lt`/`.gt` against an ISO instant string is correct here too. All-day
 * and timed rows are queried separately (two straightforward, fully
 * type-safe chained filters) rather than one combined `.or()` string —
 * this avoids embedding date/timestamp values inside a raw PostgREST
 * filter expression, which is unnecessary and needlessly fragile here.
 * Overlap semantics: `event.start < to AND event.end > from` — matches
 * `CalendarRange`'s own `[start, end)` exclusive-end convention exactly,
 * so a Google all-day event's already-exclusive `end_date` needs no
 * adjustment for this comparison (only the *display* mapping layer
 * converts it to the calendar UI's own inclusive convention).
 */
export async function listActiveEventsForCalendarInRange(calendarId: string, fromIso: string, toIso: string): Promise<GoogleCalendarEvent[]> {
  const supabase = await createSupabaseClient();
  const fromDate = fromIso.slice(0, 10);
  const toDate = toIso.slice(0, 10);

  const [allDayResult, timedResult] = await Promise.all([
    supabase.from("google_calendar_events").select("*").eq("calendar_id", calendarId).is("cancelled_at", null).eq("all_day", true).lt("start_date", toDate).gt("end_date", fromDate),
    supabase.from("google_calendar_events").select("*").eq("calendar_id", calendarId).is("cancelled_at", null).eq("all_day", false).lt("start_date_time", toIso).gt("end_date_time", fromIso),
  ]);
  if (allDayResult.error) throw normalizeSupabaseError(allDayResult.error);
  if (timedResult.error) throw normalizeSupabaseError(timedResult.error);
  return [...(allDayResult.data ?? []), ...(timedResult.data ?? [])].map(mapRow);
}

export async function updateEvent(id: string, patch: Partial<GoogleCalendarEvent>): Promise<GoogleCalendarEvent | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendar_events")
    .update({
      ...(patch.i_cal_uid !== undefined ? { i_cal_uid: patch.i_cal_uid } : {}),
      ...(patch.recurring_event_id !== undefined ? { recurring_event_id: patch.recurring_event_id } : {}),
      ...(patch.original_start_time !== undefined ? { original_start_time: patch.original_start_time } : {}),
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.location !== undefined ? { location: patch.location } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.all_day !== undefined ? { all_day: patch.all_day } : {}),
      ...(patch.start_date !== undefined ? { start_date: patch.start_date } : {}),
      ...(patch.end_date !== undefined ? { end_date: patch.end_date } : {}),
      ...(patch.start_date_time !== undefined ? { start_date_time: patch.start_date_time } : {}),
      ...(patch.end_date_time !== undefined ? { end_date_time: patch.end_date_time } : {}),
      ...(patch.time_zone !== undefined ? { time_zone: patch.time_zone } : {}),
      ...(patch.organizer !== undefined ? { organizer: patch.organizer as unknown as Record<string, unknown> | null } : {}),
      ...(patch.attendees !== undefined ? { attendees: patch.attendees as unknown as Record<string, unknown>[] } : {}),
      ...(patch.html_link !== undefined ? { html_link: patch.html_link } : {}),
      ...(patch.hangout_link !== undefined ? { hangout_link: patch.hangout_link } : {}),
      ...(patch.cancelled_at !== undefined ? { cancelled_at: patch.cancelled_at } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}
