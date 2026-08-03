-- Checkpoint 14 — Client Portal Platform: schema for the genuinely new
-- domains this checkpoint adds (Timeline needs no new schema — it only
-- reads pre-existing timestamp columns already covered by the Client
-- Portal MVP's own RLS policies).
--
-- Written and committed as a correct, ready-to-apply migration; the
-- application code this checkpoint ships treats every one of these four
-- concepts as mock-only regardless of NEXT_PUBLIC_DATA_MODE (the same
-- "new checkpoint domain, mock-only this phase" precedent
-- core/workflow/core/automation/core/documents/core/settings already
-- established) — see docs/client-portal.md's own "Known limitations" for
-- why: this session has no database credentials capable of pushing a
-- schema migration to the linked remote project, only of reading it.
-- Applying this file (`supabase db push`) and switching the relevant
-- repositories over to their Supabase implementations is what a future
-- checkpoint needs to do to make these four concepts dual-mode.

-- 1. Client Document Approval — Step 4's own "Approve (placeholder),
-- Reject (placeholder)." Bolted on as its own table rather than a new
-- column on `documents`, so the Document Platform's own draft/published/
-- archived lifecycle (Checkpoint 12) stays untouched.
create table if not exists public.client_document_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, client_account_id)
);

alter table public.client_document_approvals enable row level security;

create policy "client_document_approvals_select_own"
  on public.client_document_approvals for select
  to authenticated
  using (
    exists (select 1 from public.client_accounts ca where ca.id = client_account_id and ca.auth_user_id = auth.uid())
    or public.is_workspace_member(workspace_id)
  );

create policy "client_document_approvals_upsert_own"
  on public.client_document_approvals for insert
  to authenticated
  with check (exists (select 1 from public.client_accounts ca where ca.id = client_account_id and ca.auth_user_id = auth.uid() and ca.status = 'active'));

create policy "client_document_approvals_update_own"
  on public.client_document_approvals for update
  to authenticated
  using (exists (select 1 from public.client_accounts ca where ca.id = client_account_id and ca.auth_user_id = auth.uid() and ca.status = 'active'))
  with check (exists (select 1 from public.client_accounts ca where ca.id = client_account_id and ca.auth_user_id = auth.uid() and ca.status = 'active'));

-- 2. Client Portal Activity — Step 1/14's own observability log, also the
-- Dashboard's own "Recent Activity" card (Step 3). Insert-only via a
-- security definer function (mirrors touch_client_account_last_access())
-- so a client can never backdate or forge an entry; select is scoped to
-- the caller's own account, or any workspace member (internal review).
create table if not exists public.client_portal_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  kind text not null check (kind in ('login', 'document_viewed', 'document_downloaded', 'invoice_viewed', 'timeline_viewed', 'notification_read', 'checklist_item_completed', 'message_sent')),
  entity_id uuid,
  entity_label text,
  occurred_at timestamptz not null default now()
);

alter table public.client_portal_activities enable row level security;

create policy "client_portal_activities_select_own"
  on public.client_portal_activities for select
  to authenticated
  using (
    exists (select 1 from public.client_accounts ca where ca.id = client_account_id and ca.auth_user_id = auth.uid())
    or public.is_workspace_member(workspace_id)
  );

create or replace function public.log_client_portal_activity(p_kind text, p_entity_id uuid, p_entity_label text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account record;
begin
  select id, workspace_id into v_account from public.client_accounts where auth_user_id = auth.uid() and status = 'active' order by created_at asc limit 1;
  if v_account.id is null then
    return;
  end if;
  insert into public.client_portal_activities (workspace_id, client_account_id, kind, entity_id, entity_label)
  values (v_account.workspace_id, v_account.id, p_kind, p_entity_id, p_entity_label);
end;
$$;

revoke all on function public.log_client_portal_activity(text, uuid, text) from public;
grant execute on function public.log_client_portal_activity(text, uuid, text) to authenticated;

-- 3. Messages — Step 8's own genuinely new, deliberately minimal
-- messaging domain. One thread per Client Account per Workspace; no
-- realtime (no `supabase_realtime` publication added for either table).
create table if not exists public.client_portal_message_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_account_id uuid not null references public.client_accounts(id) on delete cascade,
  subject text not null default 'Messages',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (workspace_id, client_account_id)
);

create table if not exists public.client_portal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.client_portal_message_threads(id) on delete cascade,
  author_type text not null check (author_type in ('client', 'staff')),
  author_member_id uuid references public.workspace_members(id) on delete set null,
  body text not null,
  read_by_client_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.client_portal_message_threads enable row level security;
alter table public.client_portal_messages enable row level security;

create policy "client_portal_message_threads_select_own"
  on public.client_portal_message_threads for select
  to authenticated
  using (
    exists (select 1 from public.client_accounts ca where ca.id = client_account_id and ca.auth_user_id = auth.uid())
    or public.is_workspace_member(workspace_id)
  );

create policy "client_portal_messages_select_own"
  on public.client_portal_messages for select
  to authenticated
  using (
    exists (
      select 1 from public.client_portal_message_threads t
      join public.client_accounts ca on ca.id = t.client_account_id
      where t.id = thread_id and (ca.auth_user_id = auth.uid() or public.is_workspace_member(t.workspace_id))
    )
  );

create policy "client_portal_messages_insert_own"
  on public.client_portal_messages for insert
  to authenticated
  with check (
    exists (
      select 1 from public.client_portal_message_threads t
      join public.client_accounts ca on ca.id = t.client_account_id
      where t.id = thread_id and (ca.auth_user_id = auth.uid() or public.is_workspace_member(t.workspace_id))
    )
  );

-- 4. Checklist client-visibility — Step 7's own client-facing Checklist.
-- Additive, optional columns; every pre-existing row defaults to
-- `client_visible = false`, so nothing internal becomes client-visible
-- without a deliberate, per-item opt-in by staff.
alter table public.checklist_items add column if not exists client_visible boolean not null default false;
alter table public.checklist_items add column if not exists client_comment text;

create policy "checklist_items_select_client_account"
  on public.checklist_items for select
  to authenticated
  using (
    client_visible = true
    and owner_type = 'event'
    and exists (
      select 1 from public.events e
      where e.id = checklist_items.owner_id
        and public.is_client_account_holder_in_workspace(e.workspace_id, e.client_id)
    )
  );
