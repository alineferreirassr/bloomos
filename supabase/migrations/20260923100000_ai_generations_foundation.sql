-- SOCIAL-09B — AI Content Intelligence data foundation. Purely additive,
-- purely schema: no live AI provider, no Server Action calling a provider,
-- no UI (all deferred per SOCIAL-09A's own audit). See that checkpoint's
-- final report for the full reasoning; this migration implements only its
-- Section D (data architecture) conclusions.
--
-- ai_generations is a dedicated, independently-auditable domain — SOCIAL-09A
-- Section B explicitly required AI state NOT be attached directly to
-- idea_items/inspiration_items/script_items/script_versions/script_blocks/
-- social_posts. One row is written per AI generation and is immutable once
-- created (see reject_ai_generation_content_mutation() below); regenerating
-- always inserts a new row with the next generation_number for its
-- (source_entity_type, source_entity_id, use_case_id) — never an update to
-- a prior row's own input/output. This mirrors the same immutable-snapshot
-- philosophy already used by service_versions and script_versions, adapted
-- for a domain where every "version" is born already-terminal (there is no
-- draft/published split here — a generation simply exists, and a human may
-- later approve or reject it).
--
-- source_entity_type/source_entity_id is the same polymorphic owner_type/
-- owner_id pattern already established by media_assets/notes/
-- timeline_activities/checklist_items (see those tables' own migrations) —
-- the only pattern in this schema that safely lets one table reference
-- several different parent tables without a real multi-target FK, which
-- Postgres cannot express directly. Scoped, exactly like every other table
-- using this pattern, to only the owner types this table actually needs
-- today (idea_item/inspiration_item/script_item — the three domains
-- SOCIAL-09A's own Section B data-signal audit identified), independent of
-- the global EntityType enum (which has no idea_item/script_item entry yet
-- — widening it is an unrelated change this migration does not make).
-- source_entity_id has no direct FK for the same reason no owner_id column
-- in this codebase ever does when it is polymorphic: workspace + entity-type
-- ownership is re-verified at the Server Action layer
-- (src/modules/aiGeneration/aiGenerationActions.ts), never provable by the
-- column alone.
--
-- input/output are the one deliberate JSONB exception SOCIAL-09B's own
-- authorization allows, and only after this documented justification: the
-- existing AI platform contract already treats both as untyped at this
-- exact boundary — `AIUseCaseDefinition.buildMessages(context: unknown,
-- input: unknown)` and `SkillDefinition.outputSchema: ZodType` (a
-- per-use-case Zod schema, not one fixed shape) in src/core/ai/prompts/
-- types.ts and src/core/ai/skills/types.ts. A fixed set of typed columns
-- cannot safely express every future use case's own input/output shape
-- without this migration inventing and freezing that shape ahead of any
-- real use case existing — the exact kind of speculative column this
-- schema's own house style (see script_blocks' own "no block type yet"
-- precedent) avoids. No embeddings/vector column exists anywhere here, and
-- no provider credential of any kind is stored in this table.
--
-- approval_status starts 'proposed' on every row and only ever moves to
-- 'approved'/'rejected' via an explicit human reviewer action
-- (approveAIGeneration/rejectAIGeneration) — mirrors AIMemoryEntry's own
-- "model suggests, human decides" policy (src/types/aiMemory.ts,
-- src/core/ai/memory/policies.ts's defaultApprovalStatusFor) without
-- building a second approval engine: this is the same policy, applied to a
-- new, separate table, not a shared/reused engine object (there isn't a
-- generic one in this codebase that fits — the Automation Approval Engine
-- in src/core/automation/approval.ts answers a different question, "does
-- this automation step need approval before it runs," not "has a human
-- signed off on this generated content"). archived_at is a separate column
-- rather than a fourth approval_status value, matching Idea/Inspiration/
-- Script's own convention exactly (all three keep status and archived_at
-- separate) rather than AIMemoryApprovalStatus's own conflated shape, since
-- this table sits directly alongside those three domains.

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,

  source_entity_type text not null,
  source_entity_id uuid not null,

  use_case_id text not null,
  skill_id text,

  -- 1-based, unique per (source_entity_type, source_entity_id, use_case_id)
  -- — see ai_generations_source_use_case_number_unique below. Assigned by
  -- the application layer (current max + 1); the unique index is the
  -- concurrency-safety backstop, matching script_versions' own
  -- app-computed-plus-unique-index convention.
  generation_number integer not null,

  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,

  provider_id text not null,
  model text not null,
  prompt_version text not null,
  is_mock boolean not null default true,
  latency_ms integer not null,
  -- 0-100, matching AIMemoryEntry.confidence's own convention exactly.
  -- Nullable — not every use case reports one.
  confidence smallint,

  approval_status text not null default 'proposed',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,

  archived_at timestamptz,

  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ai_generations_source_entity_type_check
    check (source_entity_type in ('idea_item', 'inspiration_item', 'script_item')),
  constraint ai_generations_generation_number_check
    check (generation_number > 0),
  constraint ai_generations_latency_ms_check
    check (latency_ms >= 0),
  constraint ai_generations_confidence_check
    check (confidence is null or (confidence >= 0 and confidence <= 100)),
  constraint ai_generations_approval_status_check
    check (approval_status in ('proposed', 'approved', 'rejected')),
  -- reviewed_by/reviewed_at change together, exactly once, the moment a
  -- human approves or rejects — mirrors script_versions' own
  -- published_fields_consistency_check shape.
  constraint ai_generations_review_fields_consistency_check check (
    (approval_status = 'proposed' and reviewed_by is null and reviewed_at is null)
    or
    (approval_status in ('approved', 'rejected') and reviewed_by is not null and reviewed_at is not null)
  )
);

comment on table public.ai_generations is
  'SOCIAL-09B — one immutable AI generation record, scoped to the Idea/Inspiration/Script that requested it via the polymorphic source_entity_type/source_entity_id pair. Regeneration always inserts a new row (next generation_number); no prior row''s input/output/provider metadata may ever change (see reject_ai_generation_content_mutation()). approval_status starts proposed and only a human reviewer may move it to approved/rejected — never automatic. This table never mutates the source entity, never publishes a Social Post, and is not read by any live AI provider today (SOCIAL-09A confirmed none is configured).';
comment on column public.ai_generations.source_entity_id is
  'Polymorphic reference, paired with source_entity_type — no direct FK is possible across three different parent tables. Cross-workspace and cross-entity-type ownership is re-verified at the application layer (src/modules/aiGeneration/aiGenerationActions.ts), not provable by this column alone, the same trust boundary every other owner_type/owner_id column in this schema already relies on.';
comment on column public.ai_generations.input is
  'Untyped by deliberate, documented exception — the existing AI platform contract (AIUseCaseDefinition.buildMessages, SkillDefinition.outputSchema) already treats input/output as per-use-case shapes, not one fixed structure. Never a raw prompt string, never a raw provider response.';

create index if not exists ai_generations_workspace_created_idx
  on public.ai_generations (workspace_id, created_at desc);
create index if not exists ai_generations_source_entity_idx
  on public.ai_generations (workspace_id, source_entity_type, source_entity_id, generation_number desc);

-- Deterministic ordering + the concurrency-safety backstop for
-- generation_number described above.
create unique index if not exists ai_generations_source_use_case_number_unique
  on public.ai_generations (source_entity_type, source_entity_id, use_case_id, generation_number);

drop trigger if exists trg_ai_generations_set_updated_at on public.ai_generations;
create trigger trg_ai_generations_set_updated_at
  before update on public.ai_generations
  for each row execute function public.set_updated_at();

-- DB-layer enforcement of "never overwrite a prior AI generation" — the
-- application layer's own repository never exposes a way to change
-- input/output/provider metadata after creation, but this table's own
-- "independently auditable" requirement (SOCIAL-09A Section B) is strong
-- enough to get the same stronger, trigger-level guarantee
-- service_versions' own published-template immutability already has (see
-- 20260806101500_service_immutability_triggers.sql). Only approval_status,
-- reviewed_by, reviewed_at, archived_at, and updated_at may ever change.
create or replace function public.reject_ai_generation_content_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.workspace_id is distinct from old.workspace_id
    or new.source_entity_type is distinct from old.source_entity_type
    or new.source_entity_id is distinct from old.source_entity_id
    or new.use_case_id is distinct from old.use_case_id
    or new.skill_id is distinct from old.skill_id
    or new.generation_number is distinct from old.generation_number
    or new.input is distinct from old.input
    or new.output is distinct from old.output
    or new.provider_id is distinct from old.provider_id
    or new.model is distinct from old.model
    or new.prompt_version is distinct from old.prompt_version
    or new.is_mock is distinct from old.is_mock
    or new.latency_ms is distinct from old.latency_ms
    or new.confidence is distinct from old.confidence
    or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
  then
    raise exception 'An AI generation record is immutable — only its approval_status, reviewed_by, reviewed_at, and archived_at may ever change.' using errcode = 'P0021';
  end if;
  return new;
end;
$$;

comment on function public.reject_ai_generation_content_mutation() is
  'Rejects any update to ai_generations that changes anything besides approval_status/reviewed_by/reviewed_at/archived_at/updated_at — the DB-layer enforcement of "regeneration creates a new row, never edits a prior one." See SOCIAL-09B''s own final report.';

drop trigger if exists trg_ai_generations_reject_content_mutation on public.ai_generations;
create trigger trg_ai_generations_reject_content_mutation
  before update on public.ai_generations
  for each row execute function public.reject_ai_generation_content_mutation();

alter table public.ai_generations enable row level security;

-- Same shape as every other business-module table in this schema:
-- workspace isolation only via is_workspace_member(workspace_id). No new
-- permission is created here — social.view/social.create, matching
-- Idea/Inspiration/Script's own established split (read here, write inside
-- each Server Action). No DELETE policy anywhere — an AI generation record
-- is never physically deleted; archived_at is the only destructive-adjacent
-- lifecycle state, and even that never removes the row.
create policy "ai_generations_select_workspace_member"
  on public.ai_generations for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "ai_generations_insert_workspace_member"
  on public.ai_generations for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "ai_generations_update_workspace_member"
  on public.ai_generations for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
