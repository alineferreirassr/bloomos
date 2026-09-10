-- GCAL-03 — Google Calendar (Read-Only) Calendar List Persistence.
-- Schema and RLS only — no event rows, no event sync, no Calendar UI.
-- One row per calendar visible under a connected google_calendar_accounts
-- row (Google's own `calendarList.list` entries), not per event.
--
-- Ownership model matches gmail_threads' own denormalized-but-reverified
-- shape exactly, one level under google_calendar_accounts instead of
-- gmail_mailboxes: workspace_id/member_id are copied onto this row for
-- query/index convenience, but RLS independently re-derives them from
-- the owning account row (see policy below) — a forged/mismatched value
-- on this row alone is never trusted.
--
-- sync_token: added now (nullable, unused) rather than in a later
-- migration, per GCAL-01's own finding that Google's Calendar sync token
-- is issued per-calendar (unlike Gmail's per-mailbox history_id) — so
-- GCAL-05's incremental sync work has a place to write to without a
-- second schema change. GCAL-03 itself never populates or reads this
-- column; every row created here has sync_token = null.
--
-- Deletion/staleness: Google Calendar entries missing from a later
-- listing are NOT deleted or marked here — see
-- googleCalendarAccountService.ts's own doc comment for why GCAL-03
-- deliberately defers stale-calendar semantics rather than inventing an
-- unevidenced deletion/staleness model.

create table if not exists public.google_calendars (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  member_id             uuid not null references auth.users (id) on delete cascade,
  account_id            uuid not null references public.google_calendar_accounts (id) on delete cascade,
  -- Google's own calendar id — see this file's own header comment.
  provider_calendar_id  text not null,
  summary               text,
  description           text,
  time_zone             text,
  access_role           text,
  is_primary            boolean not null default false,
  is_selected           boolean not null default false,
  -- Reserved for GCAL-05 — always null through GCAL-03. See this file's own header comment.
  sync_token            text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (account_id, provider_calendar_id)
);

comment on table public.google_calendars is
  'One row per Google Calendar visible to a connected google_calendar_accounts row (GCAL-03) — the calendars themselves, not the events inside them. member_id is required (never null), matching google_calendar_accounts exactly: this is a specific member''s own personal calendar list, not shared workspace infrastructure.';

comment on column public.google_calendars.account_id is
  'References google_calendar_accounts(id). A plain FK only — cannot itself enforce workspace/member match; that is validated in googleCalendarAccountManager.ts and independently re-verified by RLS below. See this file''s own header comment.';

create index if not exists google_calendars_account_id_idx on public.google_calendars (account_id);
create index if not exists google_calendars_workspace_id_idx on public.google_calendars (workspace_id);
create index if not exists google_calendars_member_id_idx on public.google_calendars (member_id);

alter table public.google_calendars enable row level security;

-- google_calendars: re-verifies against the OWNING google_calendar_accounts
-- row (not just this row's own denormalized workspace_id/member_id) —
-- a row whose account_id points to someone else's real account is denied
-- even if its own workspace_id/member_id columns were forged to look
-- like the caller's. Mirrors gmail_threads_own_scope exactly.
create policy "google_calendars_own_scope"
  on public.google_calendars for all
  to authenticated
  using (
    exists (
      select 1 from public.google_calendar_accounts acc
      where acc.id = account_id
        and acc.workspace_id = google_calendars.workspace_id
        and acc.member_id = google_calendars.member_id
        and public.is_workspace_member(acc.workspace_id)
        and acc.member_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.google_calendar_accounts acc
      where acc.id = account_id
        and acc.workspace_id = google_calendars.workspace_id
        and acc.member_id = google_calendars.member_id
        and public.is_workspace_member(acc.workspace_id)
        and acc.member_id = auth.uid()
    )
  );
