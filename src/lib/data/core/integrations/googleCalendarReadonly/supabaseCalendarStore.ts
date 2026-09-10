import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import type { Database } from "@/types/database.types";
import type { GoogleCalendar } from "@/core/integrations/googleCalendarReadonly/types";

/** GCAL-03 — the real, durable counterpart to `calendarStore.ts`'s mock implementation. Uses the server-only, session-bound Supabase client — every read/write here runs as the calling user under RLS (`google_calendars_own_scope`), since this codebase never uses a service-role client. */
type CalendarRow = Database["public"]["Tables"]["google_calendars"]["Row"];

function mapRow(row: CalendarRow): GoogleCalendar {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    member_id: row.member_id,
    account_id: row.account_id,
    provider_calendar_id: row.provider_calendar_id,
    summary: row.summary,
    description: row.description,
    time_zone: row.time_zone,
    access_role: row.access_role,
    is_primary: row.is_primary,
    is_selected: row.is_selected,
    sync_token: row.sync_token,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function insertCalendar(calendar: GoogleCalendar): Promise<GoogleCalendar> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendars")
    .insert({
      id: calendar.id,
      workspace_id: calendar.workspace_id,
      member_id: calendar.member_id,
      account_id: calendar.account_id,
      provider_calendar_id: calendar.provider_calendar_id,
      summary: calendar.summary,
      description: calendar.description,
      time_zone: calendar.time_zone,
      access_role: calendar.access_role,
      is_primary: calendar.is_primary,
      is_selected: calendar.is_selected,
      sync_token: calendar.sync_token,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);
  return mapRow(data);
}

export async function getCalendarById(id: string): Promise<GoogleCalendar | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendars").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function getCalendarByProviderId(accountId: string, providerCalendarId: string): Promise<GoogleCalendar | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendars").select("*").eq("account_id", accountId).eq("provider_calendar_id", providerCalendarId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}

export async function listCalendarsForAccount(accountId: string): Promise<GoogleCalendar[]> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase.from("google_calendars").select("*").eq("account_id", accountId).order("created_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapRow);
}

export async function updateCalendar(id: string, patch: Partial<GoogleCalendar>): Promise<GoogleCalendar | null> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("google_calendars")
    .update({
      ...(patch.summary !== undefined ? { summary: patch.summary } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.time_zone !== undefined ? { time_zone: patch.time_zone } : {}),
      ...(patch.access_role !== undefined ? { access_role: patch.access_role } : {}),
      ...(patch.is_primary !== undefined ? { is_primary: patch.is_primary } : {}),
      ...(patch.is_selected !== undefined ? { is_selected: patch.is_selected } : {}),
      ...(patch.sync_token !== undefined ? { sync_token: patch.sync_token } : {}),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapRow(data) : null;
}
