-- GCAL-02 — Member-Owned Google Calendar (Read-Only) Account Foundation.
-- Schema and RLS only — no calendar-list persistence, no event sync, no
-- Calendar UI. Real calendar-listing/event-sync work is GCAL-03+'s
-- responsibility; this migration exists so that work has a durable,
-- secure place to write to.
--
-- This is deliberately a SEPARATE domain from the pre-existing
-- `google-calendar` provider (core/integrations/providers/googleCalendar/,
-- workspace-owned, write-capable, used by the Workflow/Marketplace
-- automation platform to push BloomOS Events out). That provider's own
-- integration_connections rows are completely untouched by this
-- migration — see calendarProviders.ts's own doc comment for the full
-- reasoning behind two separate provider ids for the same real-world
-- service.
--
-- Ownership model matches GMAIL-04's gmail_mailboxes exactly, not
-- GMAIL-02/GC-shared integration_connections' OPTIONAL member_id: a
-- connected Google Calendar ACCOUNT here is a specific member's own
-- personal calendar identity, not shared workspace infrastructure —
-- member_id is REQUIRED, and no policy grants a workspace owner/admin an
-- exception.
--
-- Connection binding: google_calendar_accounts.integration_connection_id
-- is a plain FK to integration_connections(id) — it cannot, by itself,
-- force that row's provider_id to be 'google-calendar-readonly' or its
-- workspace_id/member_id to match without a trigger. Enforcing "the
-- referenced connection is really provider_id='google-calendar-readonly'
-- in the same workspace/member" is done at the repository layer
-- (googleCalendarAccountManager.ts), not the database — the same known,
-- deliberate limitation GMAIL-04's own header comment already documents
-- for gmail_mailboxes.
--
-- Identity: Google's own `calendars.get('primary')` response has no
-- distinct opaque "account id" separate from the account's email for a
-- primary calendar — provider_account_id and provider_account_email are
-- both nullable (null until identification has run once) and, when set,
-- carry the same underlying value. See googleCalendarIdentity.ts's own
-- doc comment.

create table if not exists public.google_calendar_accounts (
  id                         uuid primary key default gen_random_uuid(),
  workspace_id               uuid not null references public.workspaces (id) on delete cascade,
  member_id                  uuid not null references auth.users (id) on delete cascade,
  integration_connection_id  uuid not null references public.integration_connections (id) on delete cascade,
  -- Google's own primary-calendar `id` — see this file's own header comment.
  provider_account_id        text,
  -- Same underlying value as provider_account_id for a primary calendar.
  provider_account_email     text,
  sync_status                 text not null default 'not_synced'
                              check (sync_status in ('not_synced', 'syncing', 'synced', 'error')),
  last_synced_at              timestamptz,
  last_successful_sync_at     timestamptz,
  -- A short, non-sensitive machine-readable code (e.g.
  -- "google_calendar_unauthorized") — never a raw provider error body.
  sync_error_code              text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (integration_connection_id)
);

comment on table public.google_calendar_accounts is
  'One row per member-owned Google Calendar (read-only) account, bound to its own integration_connections row (provider_id=google-calendar-readonly). Schema/repository foundation only (GCAL-02) — no calendar list, no event sync yet. member_id is required (never null): this is a specific member''s own personal calendar identity, not shared workspace infrastructure.';

comment on column public.google_calendar_accounts.integration_connection_id is
  'References integration_connections(id). A plain FK only — cannot itself enforce provider_id=google-calendar-readonly or workspace/member match; that is validated in googleCalendarAccountManager.ts. See this file''s own header comment.';

create index if not exists google_calendar_accounts_workspace_id_idx on public.google_calendar_accounts (workspace_id);
create index if not exists google_calendar_accounts_member_id_idx on public.google_calendar_accounts (member_id);

alter table public.google_calendar_accounts enable row level security;

-- google_calendar_accounts: member-owned only — no workspace-owned shape,
-- no owner/admin exception, matching gmail_mailboxes_own_scope exactly.
create policy "google_calendar_accounts_own_scope"
  on public.google_calendar_accounts for all
  to authenticated
  using (public.is_workspace_member(workspace_id) and member_id = auth.uid())
  with check (public.is_workspace_member(workspace_id) and member_id = auth.uid());
