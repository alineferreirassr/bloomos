-- GCAL-04 — Google Calendar (Read-Only) Bounded Initial Event Sync —
-- Event Persistence Foundation. Schema and RLS only — no incremental
-- sync, no Calendar UI, no write-back to Google. One row per event
-- instance visible under a connected google_calendars row (Google's
-- own `events.list?singleEvents=true` entries — already-expanded
-- recurring occurrences, never a recurring series master).
--
-- Ownership model matches google_calendars' own denormalized-but-
-- reverified shape exactly, one level under google_calendars instead
-- of google_calendar_accounts: workspace_id/member_id are copied onto
-- this row for query/index convenience, but RLS independently
-- re-derives them from the owning calendar row (see policy below) — a
-- forged/mismatched value on this row alone is never trusted.
--
-- All-day vs timed: Google represents an all-day event via
-- start.date/end.date (plain date strings, no time/zone component) and
-- a timed event via start.dateTime/end.dateTime + start.timeZone. This
-- table keeps both representations as separate, mutually-exclusive
-- column pairs (start_date/end_date vs start_date_time/end_date_time)
-- rather than coercing an all-day event into a UTC timestamp, which
-- would corrupt its whole-day meaning for a viewer in a different
-- timezone — see googleCalendarEventApi.ts's own doc comment.
-- end_date is preserved exactly as Google returns it (exclusive, per
-- Google's own all-day convention) — never silently adjusted to an
-- inclusive value here; that belongs to a future UI mapping layer.
--
-- Cancellation: a single canonical `cancelled_at timestamptz` column
-- (nullable), set when Google reports `status = 'cancelled'`, matching
-- gmail_messages.deleted_at's own established "one field, never a
-- redundant boolean" convention exactly. Never a hard delete.
--
-- Recurrence: `recurring_event_id` links an expanded occurrence back to
-- its recurring series (Google's own `recurringEventId`); a recurring
-- series MASTER is never persisted here (Google never returns one when
-- `singleEvents=true`, the only mode this domain uses).
-- `original_start_time` carries Google's own raw `originalStartTime`
-- value (a date-or-dateTime string) when present — necessary to
-- correctly identify WHICH occurrence a minimal cancellation payload
-- (which often omits its own start/end) refers to within a recurring
-- series.
--
-- Attendees/organizer: intentionally minimized jsonb shapes (email,
-- displayName, responseStatus/self/optional where applicable) — never
-- the full Google attendee/organizer object. See
-- googleCalendarEventApi.ts's own doc comment for the exact fields
-- read.
--
-- sync_token: this migration does not touch google_calendars.sync_token
-- at all — GCAL-04 leaves it exactly as GCAL-03 left it (always null).

create table if not exists public.google_calendar_events (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  member_id             uuid not null references auth.users (id) on delete cascade,
  calendar_id           uuid not null references public.google_calendars (id) on delete cascade,
  -- Google's own event id — see this file's own header comment.
  provider_event_id     text not null,
  -- Metadata only — never used as this row's own unique provider identity (that's provider_event_id).
  i_cal_uid             text,
  recurring_event_id    text,
  original_start_time   text,
  summary               text,
  description           text,
  location               text,
  -- Google's own raw status string (confirmed/tentative/cancelled) — cancelled_at below is this table's own canonical tombstone signal, not this column.
  status                text,
  all_day               boolean not null default false,
  start_date            date,
  end_date               date,
  start_date_time        timestamptz,
  end_date_time           timestamptz,
  time_zone              text,
  organizer              jsonb,
  attendees              jsonb not null default '[]'::jsonb,
  html_link              text,
  hangout_link           text,
  -- Single-field tombstone — see this file's own header comment. Null = active.
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (calendar_id, provider_event_id)
);

comment on table public.google_calendar_events is
  'One row per Google Calendar event instance (already expanded from any recurring series — singleEvents=true) visible under a connected google_calendars row (GCAL-04). member_id is required (never null), matching google_calendars/google_calendar_accounts exactly: this is a specific member''s own personal calendar content, not shared workspace infrastructure.';

comment on column public.google_calendar_events.calendar_id is
  'References google_calendars(id). A plain FK only — cannot itself enforce workspace/member match; that is validated in googleCalendarAccountManager.ts and independently re-verified by RLS below. See this file''s own header comment.';

create index if not exists google_calendar_events_calendar_id_idx on public.google_calendar_events (calendar_id);
create index if not exists google_calendar_events_workspace_id_idx on public.google_calendar_events (workspace_id);
create index if not exists google_calendar_events_member_id_idx on public.google_calendar_events (member_id);

alter table public.google_calendar_events enable row level security;

-- google_calendar_events: re-verifies against the OWNING google_calendars
-- row (not just this row's own denormalized workspace_id/member_id) —
-- a row whose calendar_id points to someone else's real calendar is
-- denied even if its own workspace_id/member_id columns were forged to
-- look like the caller's. Mirrors google_calendars_own_scope exactly,
-- one level deeper.
create policy "google_calendar_events_own_scope"
  on public.google_calendar_events for all
  to authenticated
  using (
    exists (
      select 1 from public.google_calendars cal
      where cal.id = calendar_id
        and cal.workspace_id = google_calendar_events.workspace_id
        and cal.member_id = google_calendar_events.member_id
        and public.is_workspace_member(cal.workspace_id)
        and cal.member_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.google_calendars cal
      where cal.id = calendar_id
        and cal.workspace_id = google_calendar_events.workspace_id
        and cal.member_id = google_calendar_events.member_id
        and public.is_workspace_member(cal.workspace_id)
        and cal.member_id = auth.uid()
    )
  );
