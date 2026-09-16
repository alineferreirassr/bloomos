-- SOCIAL-13J — Notification Persistence Foundation.
--
-- Moves the existing Notification module (core/notifications/types.ts,
-- lib/data/core/notifications/{repository,mockRepository}.ts) from
-- mock/in-memory-only to a real Supabase-backed persistence layer, the
-- same pattern SOCIAL-11B already established for the Automation Engine's
-- own execution history (automation_executions, see
-- 20260925100000_automation_execution_idempotency_foundation.sql) — not a
-- second Notification system, not a redesigned recipient model. SOCIAL-13I's
-- own read-only audit found this table never existed (mockRepository.ts's
-- `let notifications: Notification[] = []`); this migration gives the
-- existing NotificationsRepository interface a real Supabase
-- implementation to sit alongside its mock one.
--
-- Schema derived directly from the existing Notification type
-- (core/notifications/types.ts) — no invented field, no new column the
-- app doesn't already read/write. `kind`/`related_owner_type` are free
-- text with no CHECK constraint, mirroring automation_executions.trigger_type's
-- own reasoning exactly: both NotificationKind (core/notifications/types.ts,
-- 18 values and growing across checkpoints) and EntityType
-- (core/enums/entityType.ts, 60+ values and growing) are large,
-- actively-growing, code-level closed lists — a CHECK constraint here
-- would require a migration on every new kind/owner type, an unjustified
-- coupling to a value set that already has a real source of truth in
-- TypeScript (timeline_activities_owner_type_check paid this exact cost
-- repeatedly before that precedent was learned). `channel`/`priority` are
-- small, genuinely stable 4-value unions (a new channel requires a whole
-- new NotificationProvider implementation, not a quick addition) and DO
-- get a CHECK constraint, mirroring automation_executions.status/approval_status.
--
-- Recipient: exactly one of recipient_member_id/recipient_client_account_id
-- is ever set — enforced at the application layer (createInAppNotification(),
-- unchanged in both mockRepository.ts and this migration's new
-- supabaseRepository.ts) and now also at the database level via
-- notifications_recipient_xor_check, never a new identity architecture.
-- recipient_member_id references workspace_members(id) — the same id
-- session.membership.id already is (see notificationPlatformActions.ts's
-- own real call sites: getNotificationsForMember(session.workspace.id,
-- session.membership.id)), never auth.users(id) directly, mirroring
-- client_portal_checkpoint14.sql's own author_member_id precedent.
--
-- No updated_at column: the existing Notification type has no such field
-- (only created_at/read_at/pinned_at/archived_at) — adding one the app
-- never reads would be an invented column, the same "don't add a column
-- the app type doesn't already have" discipline automation_executions'
-- own migration comment used for its own created_at decision.
--
-- Mutations (markNotificationRead/Unread, pin/unpin, archive/unarchive) all
-- take only `id` in the existing repository interface — no workspaceId
-- parameter. RLS (not application-level filtering) is what makes these
-- safe: every policy re-derives workspace/recipient ownership from the row
-- itself, never trusts a client-supplied workspace id.
--
-- Two real actors write/read this table today (confirmed against real
-- call sites, not assumed): (1) an authenticated workspace member's own
-- session — every internal caller (announcements/messaging/reminders/
-- comments/escalation/notificationPlatformActions, plus automation actions
-- dispatched from an already-authenticated Server Action); (2) a Client
-- Portal account's own session — lib/data/index.ts's
-- getClientPortalNotifications()/markClientPortalNotificationRead() read
-- AND write under the client's own auth.uid() (confirmed by reading that
-- file directly, not assumed). Both policies below cover exactly these
-- two, reusing the same "client_accounts ca.auth_user_id = auth.uid()"
-- ownership check client_portal_checkpoint14.sql's own document-view-log
-- policies already use — no new identity mechanism introduced.
--
-- lead_created remains only a declared NotificationKind value — nothing in
-- this migration or the repositories it backs wires a Lead notification
-- call site; that is explicitly out of scope for this checkpoint.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,

  recipient_member_id uuid references public.workspace_members(id) on delete cascade,
  recipient_client_account_id uuid references public.client_accounts(id) on delete cascade,

  channel text not null default 'in_app',
  title text not null,
  body text not null default '',

  read_at timestamptz,
  created_at timestamptz not null default now(),

  related_owner_type text,
  related_owner_id uuid,

  kind text,
  priority text not null default 'normal',

  pinned_at timestamptz,
  archived_at timestamptz,

  constraint notifications_channel_check check (channel in ('in_app', 'email', 'sms', 'push')),
  constraint notifications_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
  constraint notifications_title_not_blank_check check (btrim(title) <> ''),
  constraint notifications_recipient_xor_check check (
    (recipient_member_id is not null and recipient_client_account_id is null)
    or (recipient_member_id is null and recipient_client_account_id is not null)
  )
);

comment on table public.notifications is
  'SOCIAL-13J — durable, Supabase-backed form of Notification (core/notifications/types.ts). Recipient is exactly one of recipient_member_id/recipient_client_account_id, never both. No updated_at: the app type has no such field. No DELETE policy — the existing interface has no delete method, only archive/unarchive.';
comment on column public.notifications.kind is
  'NotificationKind (core/notifications/types.ts) — free text, no CHECK: an actively-growing, code-level closed list, same reasoning as automation_executions.trigger_type.';
comment on column public.notifications.related_owner_type is
  'EntityType (core/enums/entityType.ts) — free text, no CHECK: an actively-growing, code-level closed list, same reasoning as kind above.';

create index if not exists notifications_workspace_member_idx
  on public.notifications (workspace_id, recipient_member_id, created_at desc);
create index if not exists notifications_workspace_client_account_idx
  on public.notifications (workspace_id, recipient_client_account_id, created_at desc);

alter table public.notifications enable row level security;

-- Same "workspace_id is trusted only because RLS re-derives it" boundary
-- automation_executions already relies on, widened with the one genuinely
-- new actor this table has that automation_executions doesn't: a Client
-- Portal account reading/writing its own notification rows under its own
-- auth.uid(), the same ownership check client_portal_checkpoint14.sql's
-- own policies already use.
create policy "notifications_select_access"
  on public.notifications for select
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (
      recipient_client_account_id is not null
      and exists (
        select 1 from public.client_accounts ca
        where ca.id = recipient_client_account_id and ca.auth_user_id = auth.uid()
      )
    )
  );

create policy "notifications_insert_access"
  on public.notifications for insert
  to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    or (
      recipient_client_account_id is not null
      and exists (
        select 1 from public.client_accounts ca
        where ca.id = recipient_client_account_id and ca.auth_user_id = auth.uid()
      )
    )
  );

create policy "notifications_update_access"
  on public.notifications for update
  to authenticated
  using (
    public.is_workspace_member(workspace_id)
    or (
      recipient_client_account_id is not null
      and exists (
        select 1 from public.client_accounts ca
        where ca.id = recipient_client_account_id and ca.auth_user_id = auth.uid()
      )
    )
  )
  with check (
    public.is_workspace_member(workspace_id)
    or (
      recipient_client_account_id is not null
      and exists (
        select 1 from public.client_accounts ca
        where ca.id = recipient_client_account_id and ca.auth_user_id = auth.uid()
      )
    )
  );
