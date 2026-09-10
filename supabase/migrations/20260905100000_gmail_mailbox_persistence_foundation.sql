-- GMAIL-04 — Gmail Mailbox/Thread/Message Persistence Foundation. Schema
-- and RLS only — no synchronization, no Gmail API calls, no Inbox UI.
-- Real sync/UI work is GMAIL-05+'s responsibility; this migration exists
-- so that work has a durable, secure place to write to.
--
-- Ownership model deliberately differs from GMAIL-02's shared
-- integration_connections/integration_credentials substrate: those tables
-- have an OPTIONAL member_id (null = workspace-owned, matching every
-- non-Gmail provider). A connected Gmail MAILBOX's actual content
-- (threads, messages, subjects, snippets, bodies) is personal mail, not
-- shared workspace infrastructure — member_id is REQUIRED here, and no
-- policy anywhere grants a workspace owner/admin an exception, mirroring
-- employee_wellness_checkins/employee_water_logs
-- (20260902100000_employee_wellness_privacy.sql) exactly.
--
-- Connection binding: gmail_mailboxes.integration_connection_id is a
-- plain FK to integration_connections(id) — it cannot, by itself, force
-- that row's provider_id to be 'gmail' or its workspace_id/member_id to
-- match without a trigger (Postgres has no declarative "check this other
-- table's column" constraint). Enforcing "the referenced connection is
-- really provider_id='gmail' in the same workspace/member" is done at
-- the repository layer (gmailMailboxManager.ts), not the database — a
-- known, deliberate limitation rather than an invasive trigger/composite-FK
-- redesign of the existing GMAIL-02 migration.
--
-- Attachments: not modeled as a table this checkpoint. has_attachments
-- (boolean) on gmail_messages is the only signal persisted — no bytes,
-- no metadata rows, no storage bucket. A dedicated attachment-metadata
-- table is deferred until something actually needs to list/download one.
--
-- Labels: provider label ids only (text[] on gmail_messages) — no
-- normalized gmail_labels table, no label mutation. The smaller shape a
-- read-only future Inbox UI needs; label management is out of scope.
--
-- Body storage: body_text/body_html are stored directly on gmail_messages,
-- protected by this migration's own member-owned RLS (see below) — this
-- is "RLS-protected at rest in the database," not application-level
-- encryption. No existing codebase-wide content-encryption requirement
-- exists to extend, and inventing one here would be exactly the kind of
-- unauthorized scope-widening this checkpoint's own boundary forbids.
-- body_html is never rendered anywhere in this checkpoint (no Inbox UI
-- exists yet) — a future renderer MUST sanitize it before display.

create table if not exists public.gmail_mailboxes (
  id                         uuid primary key default gen_random_uuid(),
  workspace_id               uuid not null references public.workspaces (id) on delete cascade,
  member_id                  uuid not null references auth.users (id) on delete cascade,
  integration_connection_id  uuid not null references public.integration_connections (id) on delete cascade,
  provider_account_id        text,
  -- GMAIL-03 deliberately did not request identity scopes (openid/email/profile)
  -- — nullable until a future checkpoint adds that scope; never fabricated.
  email_address               text,
  display_name                text,
  -- Gmail's own sync cursor (users.history.list's startHistoryId), opaque text.
  history_id                  text,
  sync_status                 text not null default 'not_synced'
                              check (sync_status in ('not_synced', 'syncing', 'synced', 'error')),
  last_synced_at              timestamptz,
  last_successful_sync_at     timestamptz,
  -- A short, non-sensitive machine-readable code (e.g. "token_revoked") —
  -- never a raw provider error body. See credentialManager.ts's own
  -- "never leak provider errors" precedent (GMAIL-03R2).
  sync_error_code              text,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (integration_connection_id)
);

comment on table public.gmail_mailboxes is
  'One row per member-owned Gmail mailbox, bound to its own integration_connections row (provider_id=gmail). Schema/repository foundation only (GMAIL-04) — no sync worker writes to this yet. member_id is required (never null): mailbox content is personal, not shared workspace infrastructure, unlike integration_connections.member_id.';

comment on column public.gmail_mailboxes.integration_connection_id is
  'References integration_connections(id). A plain FK only — cannot itself enforce provider_id=gmail or workspace/member match; that is validated in gmailMailboxManager.ts. See this file''s own header comment.';

create index if not exists gmail_mailboxes_workspace_id_idx on public.gmail_mailboxes (workspace_id);
create index if not exists gmail_mailboxes_member_id_idx on public.gmail_mailboxes (member_id);

create table if not exists public.gmail_threads (
  id                  uuid primary key default gen_random_uuid(),
  workspace_id        uuid not null references public.workspaces (id) on delete cascade,
  member_id           uuid not null references auth.users (id) on delete cascade,
  mailbox_id          uuid not null references public.gmail_mailboxes (id) on delete cascade,
  provider_thread_id  text not null,
  subject             text,
  snippet             text,
  latest_message_at   timestamptz,
  message_count       integer not null default 0,
  unread_count        integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (mailbox_id, provider_thread_id)
);

comment on table public.gmail_threads is
  'One row per Gmail thread within one gmail_mailboxes row. workspace_id/member_id are denormalized from the owning mailbox for query/index convenience — RLS independently re-verifies they actually match that mailbox''s own ownership (see policy below), so a forged/mismatched value here is never trusted on its own.';

create index if not exists gmail_threads_mailbox_id_idx on public.gmail_threads (mailbox_id, latest_message_at desc);
create index if not exists gmail_threads_workspace_id_idx on public.gmail_threads (workspace_id);

create table if not exists public.gmail_messages (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  member_id             uuid not null references auth.users (id) on delete cascade,
  mailbox_id            uuid not null references public.gmail_mailboxes (id) on delete cascade,
  thread_id             uuid not null references public.gmail_threads (id) on delete cascade,
  provider_message_id   text not null,
  -- Denormalized from the owning thread — lets a caller filter messages by
  -- the provider's own thread id without a join, e.g. reconciling a sync page.
  provider_thread_id    text not null,
  internal_date         timestamptz,
  subject               text,
  snippet               text,
  body_text             text,
  -- RLS-protected at rest (see policy below) — never application-level
  -- encrypted (no existing codebase-wide content-encryption requirement
  -- to extend). MUST be sanitized before ever being rendered — no renderer
  -- exists yet (no Inbox UI is in scope this checkpoint).
  body_html             text,
  from_address          jsonb,
  to_addresses          jsonb not null default '[]'::jsonb,
  cc_addresses          jsonb not null default '[]'::jsonb,
  bcc_addresses         jsonb not null default '[]'::jsonb,
  reply_to_addresses    jsonb not null default '[]'::jsonb,
  message_id_header     text,
  in_reply_to           text,
  references_header     text,
  -- Provider label ids only (e.g. "INBOX", "UNREAD") — no normalized
  -- gmail_labels table, no label mutation. See this file's own header comment.
  label_ids             text[] not null default '{}'::text[],
  is_read               boolean not null default false,
  is_starred            boolean not null default false,
  is_draft               boolean not null default false,
  is_sent                boolean not null default false,
  -- The only attachment signal persisted this checkpoint — no bytes, no
  -- metadata rows, no storage bucket. See this file's own header comment.
  has_attachments        boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (mailbox_id, provider_message_id)
);

comment on table public.gmail_messages is
  'One row per Gmail message within one gmail_threads row. Same denormalized-but-RLS-reverified workspace_id/member_id shape as gmail_threads. body_text/body_html are personal content, protected only by this table''s own RLS — see this file''s own header comment for what "protected" means here.';

create index if not exists gmail_messages_thread_id_idx on public.gmail_messages (thread_id, internal_date desc);
create index if not exists gmail_messages_mailbox_id_idx on public.gmail_messages (mailbox_id);
create index if not exists gmail_messages_workspace_id_idx on public.gmail_messages (workspace_id);

alter table public.gmail_mailboxes enable row level security;
alter table public.gmail_threads enable row level security;
alter table public.gmail_messages enable row level security;

-- gmail_mailboxes: member-owned only — no workspace-owned shape, no
-- owner/admin exception, matching employee_wellness_checkins exactly.
create policy "gmail_mailboxes_own_scope"
  on public.gmail_mailboxes for all
  to authenticated
  using (public.is_workspace_member(workspace_id) and member_id = auth.uid())
  with check (public.is_workspace_member(workspace_id) and member_id = auth.uid());

-- gmail_threads: re-verifies against the OWNING gmail_mailboxes row (not
-- just this row's own denormalized workspace_id/member_id) — a row whose
-- mailbox_id points to someone else's mailbox is denied even if its own
-- workspace_id/member_id columns were forged to look like the caller's.
create policy "gmail_threads_own_scope"
  on public.gmail_threads for all
  to authenticated
  using (
    exists (
      select 1 from public.gmail_mailboxes mb
      where mb.id = mailbox_id
        and mb.workspace_id = gmail_threads.workspace_id
        and mb.member_id = gmail_threads.member_id
        and public.is_workspace_member(mb.workspace_id)
        and mb.member_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.gmail_mailboxes mb
      where mb.id = mailbox_id
        and mb.workspace_id = gmail_threads.workspace_id
        and mb.member_id = gmail_threads.member_id
        and public.is_workspace_member(mb.workspace_id)
        and mb.member_id = auth.uid()
    )
  );

-- gmail_messages: re-verifies against BOTH the owning mailbox AND the
-- owning thread (and that the thread itself belongs to the same mailbox)
-- — the same "never trust a forged/mismatched relationship" discipline
-- as gmail_threads, one level deeper.
create policy "gmail_messages_own_scope"
  on public.gmail_messages for all
  to authenticated
  using (
    exists (
      select 1 from public.gmail_mailboxes mb
      where mb.id = mailbox_id
        and mb.workspace_id = gmail_messages.workspace_id
        and mb.member_id = gmail_messages.member_id
        and public.is_workspace_member(mb.workspace_id)
        and mb.member_id = auth.uid()
    )
    and exists (
      select 1 from public.gmail_threads th
      where th.id = thread_id
        and th.mailbox_id = gmail_messages.mailbox_id
    )
  )
  with check (
    exists (
      select 1 from public.gmail_mailboxes mb
      where mb.id = mailbox_id
        and mb.workspace_id = gmail_messages.workspace_id
        and mb.member_id = gmail_messages.member_id
        and public.is_workspace_member(mb.workspace_id)
        and mb.member_id = auth.uid()
    )
    and exists (
      select 1 from public.gmail_threads th
      where th.id = thread_id
        and th.mailbox_id = gmail_messages.mailbox_id
    )
  );

create trigger trg_gmail_mailboxes_set_updated_at
  before update on public.gmail_mailboxes
  for each row execute function public.set_updated_at();

create trigger trg_gmail_threads_set_updated_at
  before update on public.gmail_threads
  for each row execute function public.set_updated_at();

create trigger trg_gmail_messages_set_updated_at
  before update on public.gmail_messages
  for each row execute function public.set_updated_at();
