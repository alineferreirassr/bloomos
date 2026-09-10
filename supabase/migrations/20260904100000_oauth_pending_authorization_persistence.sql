-- GMAIL-03P — Durable OAuth Pending-Authorization Persistence. Replaces
-- `oauthEngine.ts`'s module-scope in-memory `pendingAuthorizations` array
-- (process-local, unsafe across the two separate HTTP requests a real
-- OAuth browser round trip needs on a serverless/Vercel deployment) with
-- a real, durable, RLS-protected table. Shared substrate — every current
-- and future OAuth-capable provider (Stripe/Twilio have no OAuth today;
-- gmail/google-calendar/google-drive/docusign/dropbox do) uses this same
-- table via `oauthEngine.ts`; no provider-specific behavior lives here.
--
-- Ownership model mirrors `integration_connections`/`integration_credentials`
-- (GMAIL-02) exactly: `workspace_id` always; optional `member_id` (null =
-- workspace-owned pending attempt, not null = member-owned, e.g. a
-- member's own in-progress Gmail connect). No owner/admin exception.
--
-- Secret handling: PKCE `code_verifier` is sensitive (it's the one secret
-- an attacker would need, alongside the intercepted `code`, to complete
-- someone else's authorization) and is never stored in plaintext here.
-- `code_verifier_ref` is an opaque `vault.secrets` id — meaningless
-- without `public.read_pending_oauth_secret()` below. That function is
-- deliberately separate from GMAIL-02's own `read_integration_secret()`:
-- a pending authorization is not an issued `integration_credentials` row,
-- and checking it against that table's ownership semantics would be
-- domain-incorrect. Writing a new secret (`store_integration_secret()`,
-- already granted to `authenticated`) has no domain-specific ownership
-- check on creation, so it's safe to reuse as-is for this table too.

create table if not exists public.oauth_pending_authorizations (
  state              text primary key,
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  member_id          uuid references auth.users (id) on delete cascade,
  provider_id        text not null,
  connection_id       uuid not null references public.integration_connections (id) on delete cascade,
  redirect_uri       text not null,
  -- Opaque vault.secrets id, or null for a provider that doesn't use PKCE.
  -- See public.read_pending_oauth_secret() below.
  code_verifier_ref  uuid,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null
);

comment on table public.oauth_pending_authorizations is
  'One row per in-flight OAuth authorization-code handshake, keyed by its own CSRF `state` value. Durable replacement for oauthEngine.ts''s prior in-memory pending-authorization store — required for a real browser round trip (authorization start and callback are separate HTTP requests) to survive a serverless/Vercel deployment. Provider-agnostic: gmail/google-calendar/google-drive/docusign/dropbox all share this one table via oauthEngine.ts. Rows are ephemeral — deleted on successful completion or cancellation, and lazily deleted once past expires_at.';

comment on column public.oauth_pending_authorizations.member_id is
  'Null = workspace-owned pending attempt (every current provider''s existing shape). Not null = member-owned (a member''s own in-progress Google/Gmail connect) — only that exact auth.users.id may read or consume the row, even within the same workspace. Mirrors integration_connections.member_id exactly; no owner/admin exception.';

comment on column public.oauth_pending_authorizations.code_verifier_ref is
  'A vault.secrets id (uuid), or null. The plaintext PKCE code_verifier is never stored on this row — only public.read_pending_oauth_secret() can resolve it, and only after re-verifying the caller owns this exact pending-authorization row.';

create index if not exists oauth_pending_authorizations_workspace_id_idx on public.oauth_pending_authorizations (workspace_id);
create index if not exists oauth_pending_authorizations_member_id_idx on public.oauth_pending_authorizations (member_id) where member_id is not null;
create index if not exists oauth_pending_authorizations_expires_at_idx on public.oauth_pending_authorizations (expires_at);

alter table public.oauth_pending_authorizations enable row level security;

-- Same own-scope shape as integration_connections: workspace-owned rows
-- (member_id is null) are visible/writable by any active Workspace
-- member; member-owned rows additionally require member_id = auth.uid().
-- This is what makes "different member/different workspace cannot
-- consume this state" a real database-level guarantee for the real
-- Supabase-backed callback path, not just an application-level check.
create policy "oauth_pending_authorizations_all_own_scope"
  on public.oauth_pending_authorizations for all
  to authenticated
  using (public.is_workspace_member(workspace_id) and (member_id is null or member_id = auth.uid()))
  with check (public.is_workspace_member(workspace_id) and (member_id is null or member_id = auth.uid()));

-- Resolves a vault secret back to plaintext for a pending OAuth
-- authorization's own code_verifier — but ONLY after confirming the
-- calling user (auth.uid()) actually owns (workspace-wide, or
-- member-wide for a member-owned row) the oauth_pending_authorizations
-- row that references p_secret_id as its code_verifier_ref. Returns null
-- rather than raising for an unowned or unknown id, matching
-- read_integration_secret()'s own "fail closed" precedent.
create or replace function public.read_pending_oauth_secret(p_secret_id uuid)
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
    from public.oauth_pending_authorizations p
    where p.code_verifier_ref = p_secret_id
      and public.is_workspace_member(p.workspace_id)
      and (p.member_id is null or p.member_id = auth.uid())
  ) into v_owned;

  if not v_owned then
    return null;
  end if;

  select decrypted_secret into v_value from vault.decrypted_secrets where id = p_secret_id;
  return v_value;
end;
$$;

revoke all on function public.read_pending_oauth_secret(uuid) from public;
grant execute on function public.read_pending_oauth_secret(uuid) to authenticated;
