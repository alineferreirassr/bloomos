-- SOCIAL-13C-FND — Lead Social Capture Data Foundation.
--
-- Purpose: let a future Lead be represented honestly when it originates
-- from an Instagram comment/DM (SOCIAL-13B's own enriched trigger facts),
-- where no email and no real first/last name will ever be available —
-- Meta's Graph API exposes neither for a commenter or DM participant.
-- SOCIAL-13C's own architecture audit found this was structurally
-- impossible before this migration: `email`/`first_name`/`last_name` were
-- NOT NULL at the DB, TypeScript, and zod-runtime-validation layers all
-- three, and no field existed to hold a stable, indexable Instagram
-- identifier for safe deduplication (`leads.instagram` is free-text,
-- unindexed, and holds a *username* — mutable, never a safe dedup key on
-- its own).
--
-- This migration does NOT implement Instagram Lead capture itself (that's
-- SOCIAL-13C's own Automation Action, still unauthorized as of this
-- checkpoint) — it only makes the *data model* capable of representing it
-- correctly, without weakening manual, human-entered Lead creation at all:
-- `leadFormSchema`/`leadDataSchema` (src/modules/leads/schema.ts) are
-- entirely untouched by this migration — the human-facing form still
-- requires a valid name and email on every manual Lead, exactly as before.
--
-- Three parts:
--
-- 1. `leads.email`/`first_name`/`last_name` become nullable. Safe and
--    fully backward-compatible: every existing Lead already has real
--    values in all three columns (this migration changes no data), and
--    the only two write paths that exist today (`createLead`/`updateLead`,
--    both mock and Supabase) still gate on `leadDataSchema.safeParse`,
--    which still requires all three fields non-empty — so nothing about
--    the existing, already-shipped manual-creation flow becomes able to
--    produce a null-email/name Lead as a side effect of this migration
--    alone. A null value here can only ever come from a future, separate,
--    explicitly-authorized write path (SOCIAL-13C's own action), never
--    from relaxing this constraint by itself.
--
-- 2. `leads.instagram_external_id` — a new, nullable column, distinct
--    from the existing `leads.instagram` (a free-text, user-editable
--    username) — this one is meant to hold Meta's own stable external id
--    (an Instagram-scoped id, never a mutable handle), safe to index and
--    match on. A partial unique index scoped to `(workspace_id,
--    instagram_external_id)` — never a bare/global unique constraint —
--    means: the same external id is allowed to exist once per workspace
--    (a genuine duplicate within one workspace is rejected at the
--    database level, closing the "check-then-act" race a future
--    application-level-only dedup check could never fully close on its
--    own) while the identical external id in a *different* workspace is
--    entirely unaffected — matching every other Instagram-domain table's
--    own workspace-scoped uniqueness shape
--    (`instagram_comments`/`instagram_conversations`, SOCIAL-11D). Every
--    existing Lead gets `instagram_external_id = NULL` by construction
--    (a new column with no default, added to an already-populated table)
--    — there is no existing data that could possibly violate this new
--    index; nothing to verify beyond that structural fact.
--
-- 3. `convert_lead_to_client(uuid, text)` (Supabase-mode conversion,
--    `security invoker`, last defined in
--    20260728100100_convert_lead_to_client_dedup.sql) is updated with
--    exactly one new guard: a Lead with no email now raises a clean,
--    stable `P0001` business-rule rejection *before* attempting the
--    existing-Client email-match query or a `clients` insert — closing
--    the one real crash/failure path this nullability change would
--    otherwise open (today, `lower(trim(NULL))` in the match query
--    silently evaluates to NULL, never matches, and the subsequent
--    INSERT would then hit `clients.email`'s own unrelated, untouched
--    NOT NULL constraint with a raw, unfriendly Postgres error instead of
--    a clear business message). This exactly mirrors the equivalent guard
--    added to the mock implementation
--    (`src/modules/leads/services/LeadConversionService.ts`). `clients`
--    itself is NOT altered by this migration in any way — a Lead with no
--    email simply cannot be converted to a Client until a real email is
--    added, by explicit design (see this checkpoint's own report).

alter table public.leads
  alter column email drop not null,
  alter column first_name drop not null,
  alter column last_name drop not null,
  add column instagram_external_id text;

create unique index leads_workspace_instagram_external_id_idx
  on public.leads (workspace_id, instagram_external_id)
  where instagram_external_id is not null;

comment on column public.leads.instagram_external_id is
  'Meta''s own stable Instagram-scoped external id for the comment author/DM participant this Lead originated from — distinct from leads.instagram (a free-text, user-editable username). Null for every manually-created Lead. Workspace-scoped uniqueness only (see leads_workspace_instagram_external_id_idx), never global.';

create or replace function public.convert_lead_to_client(p_lead_id uuid, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_client public.clients%rowtype;
  v_existing_client_id uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;

  if not found then
    raise exception 'Lead not found.' using errcode = 'P0001';
  end if;

  if v_lead.status = 'archived' then
    raise exception 'Archived leads cannot be converted to a Client.' using errcode = 'P0001';
  end if;

  if v_lead.status = 'converted' or v_lead.converted_client_id is not null then
    raise exception 'This lead has already been converted to a Client.' using errcode = 'P0001';
  end if;

  -- SOCIAL-13C-FND — leads.first_name/last_name/email are all now nullable
  -- (this same migration); clients' own equivalent columns remain NOT NULL
  -- and are untouched. A Lead missing any of these (an Instagram-originated
  -- Lead, before a human backfills the rest) cannot be converted — rejected
  -- here, cleanly, mirroring the identical two-step guard added to the mock
  -- implementation (src/modules/leads/services/LeadConversionService.ts).
  -- Without this, the email-match query below would silently no-op on a
  -- NULL comparison and fall through to an insert that clients' own
  -- unrelated NOT NULL constraints would then reject with a raw,
  -- unfriendly error instead of this clear one.
  if v_lead.first_name is null or v_lead.last_name is null then
    raise exception 'A name is required before this lead can be converted to a Client.' using errcode = 'P0001';
  end if;

  if v_lead.email is null then
    raise exception 'A valid email is required before this lead can be converted to a Client.' using errcode = 'P0001';
  end if;

  select id into v_existing_client_id
  from public.clients
  where workspace_id = v_lead.workspace_id
    and lower(trim(email)) = lower(trim(v_lead.email))
  order by created_at asc
  limit 1;

  if v_existing_client_id is not null then
    update public.clients
    set originating_lead_id = coalesce(originating_lead_id, v_lead.id)
    where id = v_existing_client_id
    returning * into v_client;
  else
    insert into public.clients (
      workspace_id, originating_lead_id, first_name, last_name, email, phone, instagram, source, internal_status
    ) values (
      v_lead.workspace_id, v_lead.id, v_lead.first_name, v_lead.last_name, v_lead.email, v_lead.phone,
      v_lead.instagram, v_lead.source, 'active'
    )
    returning * into v_client;
  end if;

  update public.leads
  set status = 'converted', converted_client_id = v_client.id
  where id = v_lead.id
  returning * into v_lead;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_lead.workspace_id, 'lead', v_lead.id, 'lead_converted', 'Lead converted to Client', p_actor,
    jsonb_build_object('client_id', v_client.id)
  );

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_client.workspace_id, 'client', v_client.id,
    case when v_existing_client_id is not null then 'client_updated' else 'client_created' end,
    case
      when v_existing_client_id is not null then 'Converted Lead linked to existing Client'
      else 'Client created from converted Lead'
    end,
    p_actor,
    jsonb_build_object('originating_lead_id', v_lead.id, 'reused_existing_client', v_existing_client_id is not null)
  );

  return jsonb_build_object('lead', to_jsonb(v_lead), 'client', to_jsonb(v_client));
end;
$$;

comment on function public.convert_lead_to_client(uuid, text) is
  'Atomically converts a Lead to a Client: validates (including, as of SOCIAL-13C-FND, that the Lead has a real email), reuses an existing Client by email match (same workspace) or inserts a new one, updates the Lead, records both timeline entries. security invoker so RLS on leads/clients/timeline_activities still applies to the calling user.';
