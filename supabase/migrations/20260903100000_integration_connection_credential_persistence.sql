-- GMAIL-02 — Secure Integration Connection + Credential Persistence
-- Foundation. Cross-provider substrate (Stripe, Twilio, DocuSign, Gmail,
-- Google Calendar, future providers alike) — this migration adds real,
-- durable, RLS-protected persistence for the `IntegrationConnection` /
-- `IntegrationCredential` records that `core/integrations/integrationManager.ts`
-- and `core/integrations/credentialManager.ts` have owned, mock-only, since
-- v2 Checkpoint 22. No provider-specific behavior changes here — this is
-- foundation only.
--
-- Ownership model: every row carries `workspace_id` (always) and an
-- OPTIONAL `member_id` (references auth.users, following the exact
-- precedent `employee_wellness_checkins`/`employee_water_logs` already
-- established for this codebase's one other self-only-privacy table).
-- `member_id is null` means a workspace-owned connection/credential — the
-- existing shape every current provider (Stripe, Twilio, DocuSign, Gmail's
-- own send-only notification path) already uses, and RLS below preserves
-- that shape exactly: any active workspace member may read/write it.
-- `member_id is not null` means a member-owned connection/credential — the
-- new shape Google/Gmail requires (GMAIL-01F): only that exact member, even
-- within the same workspace, may read or write it. No policy anywhere
-- grants a workspace owner/admin an exception to another member's own
-- connection — mirroring the wellness tables' own "no owner/admin
-- carve-out" precedent precisely, since a connected Gmail mailbox is at
-- least as personal as a mood check-in.
--
-- Token/secret confidentiality: neither table ever stores a plaintext
-- access/refresh token or provider secret. `access_token_ref`/
-- `refresh_token_ref` on integration_credentials hold an opaque
-- `vault.secrets` id (uuid) — meaningless without calling
-- `public.read_integration_secret()` below, which independently
-- re-verifies the caller's own workspace/member ownership of the
-- credential row that points at that id before ever touching
-- `vault.decrypted_secrets`. This codebase never uses a service-role
-- Supabase client anywhere (confirmed: every server-side client is the
-- anon-key + user-session client from `lib/supabase/server.ts`), so both
-- Vault-wrapper functions below are SECURITY DEFINER and granted to
-- `authenticated` directly — the safety boundary is the ownership check
-- inside each function, not the calling role.

create table if not exists public.integration_connections (
  id                    uuid primary key default gen_random_uuid(),
  workspace_id          uuid not null references public.workspaces (id) on delete cascade,
  member_id             uuid references auth.users (id) on delete cascade,
  provider_id           text not null,
  state                 text not null default 'disconnected'
                        check (state in ('disconnected', 'connecting', 'connected', 'expired', 'refreshing', 'failed', 'disabled', 'reconnecting', 'unknown')),
  config                jsonb not null default '{}'::jsonb,
  credential_id         uuid,
  capabilities          text[] not null default '{}'::text[],
  version               int not null default 1,
  installed_by          uuid not null references auth.users (id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_state_change_at  timestamptz not null default now(),
  last_health_check_at  timestamptz,
  last_sync_at          timestamptz,
  failure_count         int not null default 0,
  retry_count           int not null default 0
);

comment on table public.integration_connections is
  'One row per connected third-party provider account. workspace_id scopes every row to its Workspace; member_id (nullable) additionally scopes a member-owned connection (e.g. a member''s own connected Gmail mailbox) to that exact member — see this file''s own header comment. Provider-agnostic: Stripe/Twilio/DocuSign/Gmail/Google Calendar all share this one table.';

comment on column public.integration_connections.member_id is
  'Null = workspace-owned (every current provider''s existing shape: Stripe/Twilio/DocuSign/Gmail-send). Not null = member-owned (Google/Gmail inbox connections going forward) — only that exact auth.users.id may read or write the row, even within the same workspace. No owner/admin exception exists or should ever be added, matching employee_wellness_checkins/employee_water_logs.';

create index if not exists integration_connections_workspace_id_idx on public.integration_connections (workspace_id);
create index if not exists integration_connections_member_id_idx on public.integration_connections (member_id) where member_id is not null;
create index if not exists integration_connections_provider_id_idx on public.integration_connections (workspace_id, provider_id);

create table if not exists public.integration_connection_transitions (
  id             uuid primary key default gen_random_uuid(),
  connection_id  uuid not null references public.integration_connections (id) on delete cascade,
  from_state     text not null,
  to_state       text not null,
  event          text not null,
  occurred_at    timestamptz not null default now(),
  note           text
);

comment on table public.integration_connection_transitions is
  'Append-only state-change history for one integration_connections row. Never queried independently of its own connection, matching connectionStore.ts''s own mock-mode precedent.';

create index if not exists integration_connection_transitions_connection_id_idx on public.integration_connection_transitions (connection_id, occurred_at desc);

create table if not exists public.integration_credentials (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  member_id          uuid references auth.users (id) on delete cascade,
  connection_id       uuid not null references public.integration_connections (id) on delete cascade,
  kind               text not null check (kind in ('api_key', 'oauth_token', 'provider_secret')),
  scopes             text[] not null default '{}'::text[],
  expires_at         timestamptz,
  rotated_at         timestamptz,
  revoked_at         timestamptz,
  key_hash           text,
  key_prefix         text,
  -- Opaque vault.secrets ids — never the plaintext access/refresh token
  -- itself. See public.store_integration_secret()/read_integration_secret().
  access_token_ref   uuid,
  refresh_token_ref  uuid,
  created_by         uuid not null references auth.users (id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.integration_credentials is
  'One row per issued credential (api_key hash, oauth_token, or provider_secret) for one integration_connections row. access_token_ref/refresh_token_ref are vault.secrets ids, not plaintext — see public.read_integration_secret(). member_id mirrors the owning connection''s own ownership exactly (workspace-owned vs member-owned) — see integration_connections.member_id.';

comment on column public.integration_credentials.access_token_ref is
  'A vault.secrets id (uuid), or null. The plaintext value is never stored on this row and never returned by an ordinary select — only public.read_integration_secret() can resolve it, and only after re-verifying the caller owns this exact credential row.';

create index if not exists integration_credentials_workspace_id_idx on public.integration_credentials (workspace_id);
create index if not exists integration_credentials_member_id_idx on public.integration_credentials (member_id) where member_id is not null;
create index if not exists integration_credentials_connection_id_idx on public.integration_credentials (connection_id);

alter table public.integration_connections enable row level security;
alter table public.integration_connection_transitions enable row level security;
alter table public.integration_credentials enable row level security;

-- integration_connections: workspace-owned rows (member_id is null) are
-- visible/writable by any active Workspace member (the exact shape every
-- current provider already relies on); member-owned rows additionally
-- require member_id = auth.uid(). No owner/admin exception.
create policy "integration_connections_all_own_scope"
  on public.integration_connections for all
  to authenticated
  using (public.is_workspace_member(workspace_id) and (member_id is null or member_id = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and (member_id is null or member_id = auth.uid()));

-- Transition history follows its own connection's scope exactly — never a
-- separate, looser policy than the connection it belongs to.
create policy "integration_connection_transitions_via_connection"
  on public.integration_connection_transitions for all
  to authenticated
  using (
    exists (
      select 1 from public.integration_connections c
      where c.id = connection_id
        and public.is_workspace_member(c.workspace_id)
        and (c.member_id is null or c.member_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.integration_connections c
      where c.id = connection_id
        and public.is_workspace_member(c.workspace_id)
        and (c.member_id is null or c.member_id = auth.uid())
    )
  );

-- integration_credentials: identical own-scope shape as its connection.
-- access_token_ref/refresh_token_ref are opaque vault ids on this row —
-- selectable, but useless without read_integration_secret()'s own
-- independent re-verification below.
create policy "integration_credentials_all_own_scope"
  on public.integration_credentials for all
  to authenticated
  using (public.is_workspace_member(workspace_id) and (member_id is null or member_id = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and (member_id is null or member_id = auth.uid()));

create trigger trg_integration_connections_set_updated_at
  before update on public.integration_connections
  for each row execute function public.set_updated_at();

create trigger trg_integration_credentials_set_updated_at
  before update on public.integration_credentials
  for each row execute function public.set_updated_at();

-- Vault-backed encryption. Supabase Vault (pgsodium-backed, root key held
-- outside the database by the platform) is the pre-existing, native,
-- already-provisioned Supabase mechanism for exactly this use case — no
-- new external KMS, no invented cryptography, no key committed to this
-- repository. Neither function is ever called with a real third-party
-- token yet (no live Google OAuth client is configured — see
-- docs/oauth-engine.md's own addendum) — both exist so the shape is
-- correct for when one is.
create extension if not exists supabase_vault;

-- Stores a plaintext secret in Vault and returns its opaque id. Safe to
-- grant directly to authenticated: creating a new vault secret discloses
-- nothing on its own — the ownership check that matters happens at the
-- integration_credentials row (RLS above) that comes to reference this id.
create or replace function public.store_integration_secret(p_plaintext text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_id uuid;
begin
  v_id := vault.create_secret(p_plaintext, coalesce(p_name, 'integration_secret_' || gen_random_uuid()::text));
  return v_id;
end;
$$;

revoke all on function public.store_integration_secret(text, text) from public;
grant execute on function public.store_integration_secret(text, text) to authenticated;

-- Resolves a vault secret back to plaintext — but ONLY after confirming
-- the calling user (auth.uid()) actually owns (workspace-wide, or
-- member-wide for a member-owned row) the integration_credentials row that
-- references p_secret_id as either its access_token_ref or
-- refresh_token_ref. Returns null rather than raising for an unowned or
-- unknown id, matching this codebase's own "fail closed, return null"
-- credential-resolution precedent (credentialManager.ts's resolveAccessToken).
create or replace function public.read_integration_secret(p_secret_id uuid)
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  v_owned boolean;
  v_value text;
begin
  select exists (
    select 1
    from public.integration_credentials c
    where (c.access_token_ref = p_secret_id or c.refresh_token_ref = p_secret_id)
      and public.is_workspace_member(c.workspace_id)
      and (c.member_id is null or c.member_id = auth.uid())
  ) into v_owned;

  if not v_owned then
    return null;
  end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = p_secret_id;
  return v_value;
end;
$$;

revoke all on function public.read_integration_secret(uuid) from public;
grant execute on function public.read_integration_secret(uuid) to authenticated;
