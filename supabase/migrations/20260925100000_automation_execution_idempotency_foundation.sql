-- SOCIAL-11B — Durable Automation Execution + Idempotency Foundation.
--
-- Purely additive, purely schema: no Meta/Instagram webhook, no comments,
-- no DMs, no auto-reply, no Lead Capture, no UI. SOCIAL-11A's own read-only
-- audit found the Automation Engine's execution history
-- (core/automation/manager.ts -> lib/data/core/automation/mockRepository.ts)
-- is mock/in-memory only, and that the only real, reusable idempotency
-- precedent in this schema is stripe_webhook_events' own
-- "INSERT ... ON CONFLICT (unique key) DO NOTHING" shape (Stripe's own
-- actual dedup, findExistingPaymentByReference, is domain-specific and not
-- reusable) plus docusign_webhook_reconciliations' "RLS enabled, zero
-- policies, SECURITY DEFINER-function-only" internal-infrastructure shape.
-- This migration gives the existing AutomationRepository interface
-- (lib/data/core/automation/repository.ts) a real Supabase-backed
-- implementation to sit alongside its mock one — not a second Automation
-- Engine, not a second execution system.
--
-- THREE new tables:
--
-- automation_executions — one row per AutomationExecution
-- (types/automation.ts), written once by recordExecution() and mutated at
-- most once more by approveExecution()/rejectExecution() (a "pending"
-- approval_status moving to a terminal one) — mirrors
-- mockRepository.ts's own exact read/write shape, including a faithfully
-- preserved existing quirk: approveExecution() only ever updates
-- approval_status/approved_by/approved_at, never `status` itself (which
-- stays 'pending_approval' even after approval) — rejectExecution() is the
-- one path that also sets status='rejected'/completed_at. This migration
-- does not change that behavior; it only persists it durably. No separate
-- created_at column: started_at (set via clockNow() in resolver.ts, before
-- persist() is ever called) already serves that role for this table
-- specifically — adding a second, always-identical "row inserted at" column
-- would duplicate a concept that already exists here, unlike every other
-- table in this schema (which has no equivalent domain timestamp of its
-- own). updated_at is real and needed (approve/reject is a genuine
-- post-insert mutation) and gets the same set_updated_at() trigger every
-- other table uses. No DELETE policy — append-only, matching
-- repository.ts's own "matches the Audit Log's own immutable-record
-- precedent" doc comment.
--
-- automation_approval_overrides — the Supabase-backed form of
-- mockRepository.ts's in-memory `Map<workspaceId, Map<automationId,
-- boolean>>` (getApprovalOverride/setApprovalOverride, the same
-- AutomationRepository interface) — not a new concept, required to fully
-- implement the existing interface contract rather than leave it partially
-- broken under Supabase mode. Natural (workspace_id, automation_id)
-- composite primary key mirrors the nested-Map shape exactly; a write is
-- always an upsert (Map.set overwrites), so no DELETE policy exists here
-- either — there is no `clearApprovalOverride` in the interface today.
--
-- automation_idempotency_keys — a NEW, generic ledger (no equivalent
-- exists anywhere in this schema): "an entity representing one delivery/
-- event, workspace-scoped, keyed by (workspace_id, source, dedup_key)."
-- `source` is a free-text producer identifier (e.g. a future
-- "meta_webhook" — nothing writes a real value yet, this checkpoint wires
-- no producer at all) so the ledger is not Meta/Instagram-specific despite
-- existing to eventually support it. Unlike stripe_webhook_events' plain
-- unique-and-permanent key, this ledger must support the real future case
-- of provider webhook redelivery after OUR OWN processing failure — Meta,
-- like Stripe, redelivers a webhook that didn't return success, and a
-- permanently-consumed key would make that redelivery silently unprocessable
-- forever. So a 'failed' key may be re-claimed; a 'processing' or
-- 'completed' one may not. That reservation-before-processing semantics
-- (the key is claimed BEFORE the automation runs, not written after
-- success) is what closes the textbook TOCTOU race the checkpoint's own
-- authorization calls out by name (two concurrent callers both observing
-- "not yet processed" before either commits) — enforced by
-- claim_automation_idempotency_key()'s single atomic
-- INSERT ... ON CONFLICT ... DO UPDATE ... WHERE statement below, in the
-- database itself, never only in application code. RLS is enabled with
-- ZERO policies, mirroring docusign_webhook_reconciliations exactly: this
-- is internal system infrastructure a future webhook-processing context
-- (no browser session, no auth.uid(), same shape as the Social scheduler's
-- own service-role boundary) reads/writes exclusively through the two
-- SECURITY DEFINER functions below, both revoked from anon/authenticated
-- and granted only to service_role — no team member or Client Portal
-- caller ever needs to read or write this table directly.

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  automation_id text not null,
  automation_name text not null,
  automation_version text not null,

  -- Free text, not a DB enum/FK: AutomationTriggerType (types/automation.ts)
  -- is a large, actively-growing, code-level closed list (20+ values and
  -- counting, including the generic "timeline_event" bridge) — the same
  -- reasoning `automation_id` itself is text, not a foreign key into a
  -- table that doesn't exist (Automations are defined in code, registered
  -- in-memory via core/automation/registry.ts, never persisted as rows).
  -- Adding a CHECK constraint here would require a migration on every new
  -- trigger type, an unjustified coupling to a value set that already has
  -- a real source of truth in TypeScript.
  trigger_type text not null,
  trigger_facts jsonb not null default '{}'::jsonb,

  conditions_passed boolean not null,

  approval_status text not null,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,

  action_results jsonb not null default '[]'::jsonb,

  status text not null,
  duration_ms integer not null,
  started_at timestamptz not null,
  completed_at timestamptz,

  -- The member whose session reached the engine, or null for a
  -- system/webhook-originated trigger (e.g. the Stripe webhook route's own
  -- dispatchAutomationTrigger calls, which pass userId: null) — resolver.ts's
  -- own `startedBy: params.userId ?? null`. Optional in the TS type
  -- (undefined on any execution recorded before this field existed); every
  -- row this table ever writes supplies it explicitly (null or a real
  -- member id), so the column itself is simply nullable, never omitted.
  started_by uuid references auth.users (id) on delete set null,

  updated_at timestamptz not null default now(),

  constraint automation_executions_approval_status_check
    check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  constraint automation_executions_status_check
    check (status in ('success', 'failure', 'partial_failure', 'pending_approval', 'skipped_conditions_not_met', 'rejected')),
  constraint automation_executions_duration_ms_check
    check (duration_ms >= 0)
);

comment on table public.automation_executions is
  'SOCIAL-11B — durable, Supabase-backed form of AutomationExecution (types/automation.ts). One row per dispatch attempt, written once by recordExecution() and mutated at most once more by approveExecution()/rejectExecution(). No created_at: started_at already serves that role for this table. Append-only — no DELETE policy.';
comment on column public.automation_executions.started_at is
  'When this execution attempt began (clockNow(), set before persist() is called) — also this row''s own creation-time marker; no separate created_at column exists.';
comment on column public.automation_executions.approval_status is
  'Faithfully preserves the existing engine''s own quirk: approveExecution() updates only approval_status/approved_by/approved_at, never status itself (which stays pending_approval even once approved) — rejectExecution() is the one path that also sets status=rejected/completed_at. Not changed by this migration.';

create index if not exists automation_executions_workspace_started_idx
  on public.automation_executions (workspace_id, started_at desc);
create index if not exists automation_executions_workspace_approval_idx
  on public.automation_executions (workspace_id, approval_status);

drop trigger if exists trg_automation_executions_set_updated_at on public.automation_executions;
create trigger trg_automation_executions_set_updated_at
  before update on public.automation_executions
  for each row execute function public.set_updated_at();

alter table public.automation_executions enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id) — no new
-- permission (the real, existing Automation Dashboard itself gates only on
-- active membership today, per getAutomationDashboardData.ts; see this
-- checkpoint's own PERMISSION_DECISION). INSERT/UPDATE both need
-- `authenticated` because the engine dispatches inline from an already-
-- authenticated Server Action's own session-bound client (never a
-- service-role client) for the majority of triggers — the same "workspace_id
-- is trusted only because RLS re-derives it via is_workspace_member(), never
-- trusted from the browser" boundary every other domain in this schema
-- already relies on.
create policy "automation_executions_select_workspace_member"
  on public.automation_executions for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "automation_executions_insert_workspace_member"
  on public.automation_executions for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "automation_executions_update_workspace_member"
  on public.automation_executions for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.automation_approval_overrides (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  automation_id text not null,
  required boolean not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (workspace_id, automation_id)
);

comment on table public.automation_approval_overrides is
  'SOCIAL-11B — Supabase-backed form of mockRepository.ts''s own in-memory approvalOverrides Map (AutomationRepository.getApprovalOverride/setApprovalOverride) — required to fully implement the existing interface, not a new capability. A write is always an upsert; no DELETE policy (the interface has no clear/remove method).';

drop trigger if exists trg_automation_approval_overrides_set_updated_at on public.automation_approval_overrides;
create trigger trg_automation_approval_overrides_set_updated_at
  before update on public.automation_approval_overrides
  for each row execute function public.set_updated_at();

alter table public.automation_approval_overrides enable row level security;

create policy "automation_approval_overrides_select_workspace_member"
  on public.automation_approval_overrides for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "automation_approval_overrides_insert_workspace_member"
  on public.automation_approval_overrides for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "automation_approval_overrides_update_workspace_member"
  on public.automation_approval_overrides for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create table if not exists public.automation_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  -- Free-text producer identifier — e.g. a future "meta_webhook". Nothing
  -- in this checkpoint writes a real value; this table has no wired
  -- producer yet (no Meta webhook exists — SOCIAL-11A's own audit).
  source text not null,
  -- The provider's own unique delivery/event identifier — e.g. a future
  -- Meta webhook delivery id. Uniqueness is scoped per (workspace, source),
  -- not globally, since two different providers (or two different
  -- workspaces' own connections to the same provider) may legitimately use
  -- overlapping id spaces.
  dedup_key text not null,

  status text not null default 'processing',
  -- Set once the claiming caller knows which execution (if any) this
  -- delivery produced — nullable because a detected-duplicate claim never
  -- produces a new execution at all, and a claim can be reserved before an
  -- execution id exists yet.
  execution_id uuid references public.automation_executions (id) on delete set null,
  attempt_count integer not null default 1,

  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint automation_idempotency_keys_status_check
    check (status in ('processing', 'completed', 'failed')),
  constraint automation_idempotency_keys_attempt_count_check
    check (attempt_count >= 1),
  constraint automation_idempotency_keys_source_not_blank_check
    check (btrim(source) <> ''),
  constraint automation_idempotency_keys_dedup_key_not_blank_check
    check (btrim(dedup_key) <> ''),
  constraint automation_idempotency_keys_unique
    unique (workspace_id, source, dedup_key)
);

comment on table public.automation_idempotency_keys is
  'SOCIAL-11B — generic, workspace-scoped durable idempotency ledger for a future provider-delivered event (e.g. a Meta/Instagram webhook — not wired to any producer in this checkpoint). One row per (workspace_id, source, dedup_key) ever claimed. A failed claim may be re-claimed (provider redelivery must be reprocessable); a processing or completed one may not. Internal system infrastructure only — RLS enabled with zero policies, written exclusively by claim_automation_idempotency_key()/complete_automation_idempotency_key() (SECURITY DEFINER, service_role only).';

drop trigger if exists trg_automation_idempotency_keys_set_updated_at on public.automation_idempotency_keys;
create trigger trg_automation_idempotency_keys_set_updated_at
  before update on public.automation_idempotency_keys
  for each row execute function public.set_updated_at();

alter table public.automation_idempotency_keys enable row level security;

-- claim_automation_idempotency_key() — the one privileged write path a
-- future webhook-processing context (no auth.uid()) uses to atomically
-- reserve a delivery before ever running the automation it triggers.
-- Mirrors claim_due_social_posts()'s exact security shape (security
-- definer, search_path pinned, service_role-only via explicit
-- revoke/grant). The ON CONFLICT ... DO UPDATE ... WHERE clause is what
-- makes re-claim-after-failure possible while still closing the race the
-- checkpoint's own authorization describes by name: two concurrent callers
-- racing the same (workspace_id, source, dedup_key) either both attempt the
-- same INSERT (Postgres serializes the conflicting write; exactly one
-- "wins" the row) or one attempts INSERT while a 'failed' row already
-- exists (the WHERE clause lets exactly one caller's UPDATE apply). A
-- caller that gets zero rows back must treat the delivery as already
-- claimed elsewhere (processing or completed) and skip it — this is the
-- entire idempotency contract, and it lives here, not in application code.
create or replace function public.claim_automation_idempotency_key(p_workspace_id uuid, p_source text, p_dedup_key text)
returns setof public.automation_idempotency_keys
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  insert into public.automation_idempotency_keys (workspace_id, source, dedup_key, status, attempt_count, claimed_at)
  values (p_workspace_id, p_source, p_dedup_key, 'processing', 1, now())
  on conflict (workspace_id, source, dedup_key) do update
    set status = 'processing',
        attempt_count = automation_idempotency_keys.attempt_count + 1,
        claimed_at = now()
    where automation_idempotency_keys.status = 'failed'
  returning *;
end;
$$;

comment on function public.claim_automation_idempotency_key(uuid, text, text) is
  'Security definer, service_role only: atomically reserves (workspace_id, source, dedup_key) for processing. Returns exactly one row on a fresh claim or a re-claimed failed key; returns zero rows if the key is already processing or completed elsewhere — the caller must treat that as a duplicate and skip. The reservation happens before the automation runs, closing the check-then-insert race at the database level.';

revoke all on function public.claim_automation_idempotency_key(uuid, text, text) from public;
revoke execute on function public.claim_automation_idempotency_key(uuid, text, text) from anon;
revoke execute on function public.claim_automation_idempotency_key(uuid, text, text) from authenticated;
grant execute on function public.claim_automation_idempotency_key(uuid, text, text) to service_role;

-- complete_automation_idempotency_key() — marks a claimed key terminal
-- (completed or failed) once processing finishes, optionally linking the
-- resulting automation_executions row. A 'failed' result is what makes the
-- key eligible for claim_automation_idempotency_key()'s own re-claim path
-- above on the provider's next redelivery.
create or replace function public.complete_automation_idempotency_key(p_id uuid, p_status text, p_execution_id uuid default null)
returns public.automation_idempotency_keys
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.automation_idempotency_keys;
begin
  if p_status not in ('completed', 'failed') then
    raise exception 'complete_automation_idempotency_key: p_status must be completed or failed, got %', p_status;
  end if;

  update public.automation_idempotency_keys
  set status = p_status,
      execution_id = coalesce(p_execution_id, execution_id),
      completed_at = now()
  where id = p_id
  returning * into v_row;

  return v_row;
end;
$$;

comment on function public.complete_automation_idempotency_key(uuid, text, uuid) is
  'Security definer, service_role only: marks a claimed idempotency key completed or failed, optionally recording which automation_executions row it produced. A failed result is what makes the key eligible for re-claim on the provider''s next redelivery.';

revoke all on function public.complete_automation_idempotency_key(uuid, text, uuid) from public;
revoke execute on function public.complete_automation_idempotency_key(uuid, text, uuid) from anon;
revoke execute on function public.complete_automation_idempotency_key(uuid, text, uuid) from authenticated;
grant execute on function public.complete_automation_idempotency_key(uuid, text, uuid) to service_role;
