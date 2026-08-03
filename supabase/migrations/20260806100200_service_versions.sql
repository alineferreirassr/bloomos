-- Services migration 3: service_versions table.
--
-- Mirrors src/types/serviceVersion.ts exactly. One immutable (once
-- published) snapshot of a Service's full operational blueprint — every
-- template table (next migrations) is scoped to service_version_id, never
-- to service_id directly, so each version carries its own complete,
-- independent set of template rows.
--
-- status: "draft" is the one mutable version every Service always has;
-- "published" is frozen forever once reached — enforced at the DB layer by
-- the immutability triggers migration (later), not just the application
-- layer. version_number is null on every draft row (it has no release
-- identity yet) and is stamped, permanently, only at publish time.
--
-- name_snapshot/description_snapshot are write-once: populated only by the
-- publish_service_version RPC (later migration) from services.name/
-- description at that exact moment, never independently editable — see
-- docs/services.md's "Locked domain decisions" #1. Both are null on every
-- draft row.
--
-- Versioning concurrency (docs/services.md's "Locked domain decisions" #2):
-- the partial unique index below enforces "a version_number, once assigned,
-- is never reused for this Service" at the DB layer — the publish RPC's own
-- row-locking on the parent services row (added in the RPC migration) is
-- what prevents two concurrent publishes from computing the same next
-- number in the first place; this index is the backstop if that ever failed.
-- The second partial unique index enforces "at most one draft per Service"
-- as a real DB invariant, matching the domain model's own stated design.

create table if not exists public.service_versions (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  version_number integer,
  status text not null default 'draft',
  name_snapshot text,
  description_snapshot text,
  base_price_minor integer not null default 0,
  currency text not null default 'USD',
  setup_duration_minutes integer,
  breakdown_duration_minutes integer,
  difficulty_score integer,
  experience_level_required text,
  weather_sensitivity text not null default 'none',
  surprise_friendly boolean not null default false,
  estimated_profit_minor integer,
  change_summary text,
  published_at timestamptz,
  published_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_versions_status_check check (status in ('draft', 'published')),
  constraint service_versions_version_number_check check (version_number is null or version_number > 0),
  constraint service_versions_base_price_minor_check check (base_price_minor >= 0),
  constraint service_versions_currency_check check (char_length(currency) = 3),
  constraint service_versions_setup_duration_minutes_check check (setup_duration_minutes is null or setup_duration_minutes >= 0),
  constraint service_versions_breakdown_duration_minutes_check check (breakdown_duration_minutes is null or breakdown_duration_minutes >= 0),
  constraint service_versions_difficulty_score_check check (difficulty_score is null or (difficulty_score between 1 and 5)),
  constraint service_versions_experience_level_required_check check (experience_level_required is null or experience_level_required in ('beginner', 'intermediate', 'expert')),
  constraint service_versions_weather_sensitivity_check check (weather_sensitivity in ('none', 'low', 'medium', 'high')),
  -- Published-only fields: a draft has none of these set, a published version has all of them set. Enforced together rather than as separate nullable checks, since they are only ever written atomically by publish_service_version.
  constraint service_versions_published_fields_consistency_check check (
    (status = 'draft' and version_number is null and published_at is null and published_by is null)
    or
    (status = 'published' and version_number is not null and published_at is not null and published_by is not null and name_snapshot is not null)
  )
);

comment on table public.service_versions is
  'Immutable-once-published snapshot of a Service''s full operational blueprint. name_snapshot/description_snapshot are write-once, set only by publish_service_version. Every template table is scoped to service_version_id. See docs/services.md.';

-- Resolves the circular reference from the previous migration: services
-- exists, service_versions now exists, so both foreign keys can be added.
alter table public.services
  add constraint services_draft_version_id_fkey foreign key (draft_version_id) references public.service_versions (id);
alter table public.services
  add constraint services_current_published_version_id_fkey foreign key (current_published_version_id) references public.service_versions (id);

create unique index if not exists service_versions_workspace_number_unique
  on public.service_versions (service_id, version_number)
  where version_number is not null;

create unique index if not exists service_versions_one_draft_per_service
  on public.service_versions (service_id)
  where status = 'draft';
