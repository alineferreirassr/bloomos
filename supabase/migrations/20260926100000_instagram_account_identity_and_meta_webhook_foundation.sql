-- SOCIAL-11C — Instagram Account Identity + Meta Webhook Receiver
-- Foundation. Purely additive, purely schema-and-ingestion-boundary: no
-- Comment/DM processing, no auto-reply, no Lead Capture, no automation
-- trigger/action, no UI.
--
-- PART 1 — instagram_account_identities.
--
-- SOCIAL-11A's own audit found `social_posts.target_instagram_account_id`
-- is a plain text column — this migration does NOT touch that column or
-- that table at all (see this checkpoint's own SOCIAL_POST_COMPATIBILITY
-- finding: `target_instagram_account_id` is a deliberate, documented
-- snapshot — types/socialPost.ts's own doc comment — captured once at
-- Social Post creation specifically so a post keeps publishing to the
-- destination it was created for even if the workspace's selected Instagram
-- identity later changes. Promoting it to a real FK would require either
-- inventing a backfill for every historical value or assuming every one is
-- safely convertible — this checkpoint does neither; the two live
-- side-by-side, `social_posts` completely unchanged).
--
-- Deeper audit (metaAccountActions.ts) found the CURRENT, only storage for
-- "which Instagram account is this workspace's Meta connection currently
-- selected to publish through" is `integration_connections.config`, a
-- generic jsonb bag with no index at all on
-- `config->>'meta_instagram_account_id'`. That is fine for the one
-- existing read pattern (load one connection by id, read its own config),
-- but is exactly what makes it unusable for what this checkpoint actually
-- needs: a webhook receiver, given only an external Instagram account id
-- from an inbound Meta payload, must resolve which workspace owns it in
-- one indexed lookup, with no auth.uid() and no connection id to key off
-- (Meta's own webhook delivery model is app-level, one callback URL for
-- every subscribed account across every workspace — unlike Stripe's
-- per-connection webhook URL, which is why stripe_webhook_events/its route
-- key off {connectionId} in the URL path and this cannot).
--
-- This table stores identity only, never credentials — no access token
-- column exists or should ever be added here; every credential stays
-- exactly where SOCIAL-02 already put it (integration_credentials,
-- resolved only through the existing Vault-backed credentialManager.ts
-- path). connection_id is the sole link proving which Meta connection (and
-- therefore which credential) this identity belongs to.
--
-- instagram_account_id is globally unique (not merely per-workspace): a
-- real Instagram Business Account can be the live webhook-subscribed
-- target of at most one owning BloomOS workspace at a time — the whole
-- point of this table is to answer "which workspace" unambiguously, which
-- a workspace-scoped-only uniqueness constraint would not guarantee.
--
-- No status/lifecycle column: the owning connection's own
-- integration_connections.state (connected/disconnected/expired/...)
-- already answers "is this identity still live" — a second, redundant
-- status field here would duplicate that concept rather than represent a
-- new one. No JSONB (nothing here needs an open-ended shape), no
-- versioning (this is a current-selection snapshot, not a history), no
-- comment/DM/lead/automation-rule/AI field (all explicitly out of this
-- checkpoint's own scope).

create table if not exists public.instagram_account_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,

  instagram_account_id text not null,
  instagram_username text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint instagram_account_identities_account_id_not_blank_check
    check (btrim(instagram_account_id) <> ''),
  constraint instagram_account_identities_account_id_unique
    unique (instagram_account_id)
);

comment on table public.instagram_account_identities is
  'SOCIAL-11C — one row per external Instagram professional account a workspace has selected through its Meta connection. Identity only, never credentials (see integration_credentials for those). instagram_account_id is globally unique, not merely per-workspace, so the Meta webhook receiver can resolve an inbound account id to exactly one owning workspace. Does not replace social_posts.target_instagram_account_id, which stays an unaltered, deliberate creation-time snapshot.';
comment on column public.instagram_account_identities.connection_id is
  'The integration_connections row (provider_id = meta) this identity was selected through — proves which connection/credential owns it, never a second credential store.';

create index if not exists instagram_account_identities_workspace_idx
  on public.instagram_account_identities (workspace_id);
create index if not exists instagram_account_identities_connection_idx
  on public.instagram_account_identities (connection_id);

drop trigger if exists trg_instagram_account_identities_set_updated_at on public.instagram_account_identities;
create trigger trg_instagram_account_identities_set_updated_at
  before update on public.instagram_account_identities
  for each row execute function public.set_updated_at();

alter table public.instagram_account_identities enable row level security;

-- Same shape as integration_connections' own workspace-owned rows: any
-- active workspace member may read/write, matching every other
-- Meta/Social-adjacent table in this schema. No new permission — write
-- access (selectMetaPublishingIdentityAction) is gated on the same
-- existing workspace.manage check metaAccountActions.ts already enforces
-- at the application layer, exactly like it already does for
-- integration_connections.config itself; RLS here only enforces
-- membership, never re-implements that permission check.
create policy "instagram_account_identities_select_workspace_member"
  on public.instagram_account_identities for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "instagram_account_identities_insert_workspace_member"
  on public.instagram_account_identities for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "instagram_account_identities_update_workspace_member"
  on public.instagram_account_identities for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- PART 2 — meta_webhook_events: the durable ingestion-boundary record for
-- one accepted Meta/Instagram webhook delivery. Audited whether
-- automation_executions (SOCIAL-11B) could represent this instead: it
-- cannot without inventing placeholder values — every one of its required
-- columns (automation_id, automation_name, automation_version, trigger_type
-- drawn from the closed AutomationTriggerType union, conditions_passed,
-- action_results) presumes a real, code-registered AutomationDefinition
-- actually ran, which this checkpoint explicitly does not create or run
-- (no Comment/DM trigger, no Reply action). This table is deliberately the
-- opposite shape: raw, unprocessed, no business meaning attached yet —
-- validation -> idempotency -> durable acceptance -> future processing,
-- never validation -> business logic.
--
-- Mirrors stripe_webhook_events' own exact shape and reasoning: workspace_id
-- is nullable (an event for an instagram_account_id this schema has no
-- instagram_account_identities row for — e.g. before that account was ever
-- selected in BloomOS, or a delivery for an unrelated Meta App subscriber —
-- must still be durably recorded, never silently dropped, so resolution
-- failure cannot be a NOT NULL violation); payload is raw jsonb for
-- audit/future reprocessing, the same deliberately narrow "one table that
-- keeps a raw external payload" precedent stripe_webhook_events already
-- established. idempotency_key_id links back to SOCIAL-11B's own
-- automation_idempotency_keys — reused directly, not duplicated: this
-- table exists only for rows that already won a real claim there.
create table if not exists public.meta_webhook_events (
  id uuid primary key default gen_random_uuid(),

  -- Nullable, not "not null": automation_idempotency_keys.workspace_id is
  -- itself NOT NULL (SOCIAL-11B), so a delivery whose external account
  -- resolves to no known workspace (see workspace_id below) has no
  -- workspace to claim an idempotency key under at all, and is recorded
  -- here without one — see this table's own CHECK constraint below, which
  -- ties the two together explicitly rather than leaving the relationship
  -- implicit. A resolved delivery (workspace_id is not null) always has a
  -- real claimed key; deliberately NOT deduplicated for an unresolved one
  -- (a rare, low-stakes case — an account BloomOS does not yet know about
  -- — documented in the route's own doc comment, not silently ignored).
  idempotency_key_id uuid references public.automation_idempotency_keys (id) on delete restrict,

  workspace_id uuid references public.workspaces (id) on delete cascade,
  instagram_account_identity_id uuid references public.instagram_account_identities (id) on delete set null,
  -- The raw external account id from the payload, kept even when
  -- resolution above failed (workspace_id/instagram_account_identity_id
  -- both null) — the only trace of "which account" for an otherwise
  -- unresolved delivery, needed to investigate/backfill later.
  external_account_id text not null,

  -- Meta's own top-level webhook "object" (e.g. "instagram") and the
  -- specific changed field/type inside one entry (e.g. a future
  -- "comments"/"messages" — not interpreted or constrained here; no CHECK,
  -- since this checkpoint deliberately does not enumerate or process any
  -- specific event type).
  object_type text not null,
  event_type text not null,

  payload jsonb not null,

  received_at timestamptz not null default now(),

  constraint meta_webhook_events_external_account_id_not_blank_check
    check (btrim(external_account_id) <> ''),
  constraint meta_webhook_events_object_type_not_blank_check
    check (btrim(object_type) <> ''),
  constraint meta_webhook_events_event_type_not_blank_check
    check (btrim(event_type) <> ''),
  -- A resolved delivery (real workspace_id) always carries the real
  -- idempotency_key_id it was claimed under; an unresolved one (no known
  -- owning workspace) never has one to claim in the first place. This is
  -- the explicit database-level statement of that relationship, not left
  -- implicit in application code alone.
  constraint meta_webhook_events_idempotency_requires_workspace_check
    check ((workspace_id is null) = (idempotency_key_id is null))
);

comment on table public.meta_webhook_events is
  'SOCIAL-11C — the durable, raw ingestion record for one accepted Meta/Instagram webhook delivery (already idempotency-claimed via automation_idempotency_keys). Ingestion boundary only, no business meaning: no Comment/DM/Lead/automation-rule processing happens against this table in this checkpoint. workspace_id/instagram_account_identity_id are nullable — an event for an unresolvable external account is still durably recorded, never dropped.';
comment on column public.meta_webhook_events.idempotency_key_id is
  'The automation_idempotency_keys row (SOCIAL-11B) this delivery successfully claimed — reused directly, never a second dedup mechanism.';

create index if not exists meta_webhook_events_workspace_received_idx
  on public.meta_webhook_events (workspace_id, received_at desc);
create index if not exists meta_webhook_events_external_account_idx
  on public.meta_webhook_events (external_account_id);

alter table public.meta_webhook_events enable row level security;

-- Mirrors stripe_webhook_events' own exact RLS shape precisely: a
-- read-only, workspace-scoped SELECT policy for a future diagnostics view,
-- excluding rows whose workspace_id hasn't been resolved; no insert/update
-- policy for authenticated at all — the webhook route has no auth.uid()
-- (an external Meta request, never a logged-in session), so its writes go
-- exclusively through a service-role client, which bypasses RLS by design.
create policy "meta_webhook_events_select_workspace_member"
  on public.meta_webhook_events for select
  to authenticated
  using (workspace_id is not null and public.is_workspace_member(workspace_id));
