-- SOCIAL-05C — Instagram Analytics Data Foundation: durable, time-series
-- snapshot storage for exactly the metrics the existing, already-shipped
-- on-demand insights feature (SOCIAL-05B — MetaProvider.getInstagramMediaInsights,
-- getSocialPostInsightsAction) already fetches and verifies against Meta's
-- own documentation (see SOCIAL-05A's own architecture-gate report).
--
-- Purely additive, purely storage: no sync engine, no cron, no Meta call,
-- no dashboard query beyond what these tables themselves need. Nothing
-- writes to these tables yet — that's SOCIAL-05D's own scope. Nothing
-- reads the existing `getSocialPostInsightsAction` behavior differently —
-- it stays on-demand and unpersisted, exactly as it is today.
--
-- HYBRID metric storage (SOCIAL-05A's own recommendation): a stable typed
-- column per metric this codebase already knows how to fetch (queryable,
-- chartable, type-safe) plus a `raw_metrics jsonb` column that absorbs
-- whatever Meta actually returns — including a metric this schema doesn't
-- yet have a typed column for — without ever needing a migration just
-- because Meta adds or renames something. `raw_metrics` must never hold a
-- secret (access token, signed URL, etc.) — it is Meta metric values only,
-- enforced at the repository layer, not by this schema.

-- ---------------------------------------------------------------------------
-- social_post_metric_snapshots — one row per (post, day) time-series point.
-- ---------------------------------------------------------------------------
--
-- Typed metric columns match EXACTLY the current, live
-- INSTAGRAM_IMAGE_INSIGHT_METRICS set in socialPostActions.ts (views,
-- reach, likes, comments, shares, saved, total_interactions) — re-derived
-- fresh from that file for this checkpoint, not assumed from SOCIAL-05A's
-- own report. `impressions` is deliberately absent: the existing code
-- already excludes it as deprecated for every image published after
-- 2024-07-02, and this migration must not contradict that live decision.
-- Every metric column is nullable — a metric absent from what Meta
-- actually returned must stay distinguishable from a real, persisted `0`
-- (mirrors MetaProvider.getInstagramMediaInsights's own "never invent a 0"
-- discipline exactly).
--
-- IDEMPOTENCY: `snapshot_date` (not `captured_at`) is the actual dedupe
-- key. A future scheduled sync (SOCIAL-05D, not built here) will retry;
-- using `captured_at` alone would let every retry mint a fresh duplicate
-- time-series point since it's a fresh timestamp every call. `snapshot_date`
-- gives a natural, deterministic "at most one snapshot per post per day"
-- granularity that a future sync can safely upsert against
-- (`on conflict (social_post_id, snapshot_date) do update`) without this
-- migration having to invent a `sync_run_id` concept for a sync engine
-- that doesn't exist yet. `captured_at` is kept alongside purely for
-- ordering/debugging precision — it is never part of the uniqueness key.
--
-- WORKSPACE INTEGRITY: workspace_id lives directly on this table (never
-- resolved only via a join through social_posts, per SOCIAL-05A's own
-- explicit contract) so RLS never has to reach through a second table.
-- The FK alone cannot prove social_post_id's own workspace_id actually
-- matches this row's workspace_id — that cross-check is the repository
-- layer's job (mirrors loadOwnedPost's own established pattern in
-- socialPostActions.ts), not something this schema can express as a
-- single-table constraint.
create table if not exists public.social_post_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  social_post_id uuid not null references public.social_posts (id) on delete cascade,
  -- SocialPost.provider_post_id at the moment this snapshot was captured —
  -- frozen here (not re-read from social_posts) so history survives even
  -- if a post's own provider_post_id field were ever cleared/changed.
  provider_media_id text not null,
  captured_at timestamptz not null default now(),
  snapshot_date date not null default current_date,

  views integer,
  reach integer,
  likes integer,
  comments integer,
  shares integer,
  saved integer,
  total_interactions integer,

  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint social_post_metric_snapshots_unique_per_day unique (social_post_id, snapshot_date)
);

comment on table public.social_post_metric_snapshots is
  'SOCIAL-05C — durable, time-series (one row per post per day) Instagram post-metric history. Nothing writes here yet; SOCIAL-05D owns the sync engine. Read-only foundation for a future analytics dashboard (SOCIAL-05E).';
comment on column public.social_post_metric_snapshots.provider_media_id is
  'SocialPost.provider_post_id, frozen at capture time — the Graph API media id this snapshot''s metrics were fetched for.';
comment on column public.social_post_metric_snapshots.snapshot_date is
  'The actual idempotency granularity (unique with social_post_id) — a future sync retries by upserting the same (social_post_id, snapshot_date) row, never by comparing captured_at.';
comment on column public.social_post_metric_snapshots.raw_metrics is
  'Forward-compatibility only: the exact Meta metric values this snapshot captured, for any metric without (or in addition to) a typed column above. Never a token, signed URL, or any other secret — Meta metric values only.';

-- Matches the repository's own listSocialPostMetricSnapshots ordering
-- (snapshot_date, the logical time-series axis and real idempotency key —
-- never captured_at, the real wall-clock capture instant, which a retry
-- or backfill could record out of logical order).
create index if not exists social_post_metric_snapshots_workspace_date_idx
  on public.social_post_metric_snapshots (workspace_id, snapshot_date desc);

alter table public.social_post_metric_snapshots enable row level security;

-- Least privilege for a persistence-foundation-only checkpoint: an
-- interactive workspace member may read snapshot history (the eventual
-- SOCIAL-05E dashboard's own read path), but nothing here grants
-- authenticated INSERT/UPDATE/DELETE. SOCIAL-05A initially sketched an
-- authenticated-insert policy for a future dashboard-adjacent write path,
-- but no such path exists yet, and this table's only intended future
-- writer (SOCIAL-05D's own service-role sync, not built in this
-- checkpoint) will bypass RLS entirely via a narrow service-role boundary
-- mirroring socialSchedulerServiceRole.ts's own established precedent —
-- exactly like social_posts' own claim_due_social_posts() never needed an
-- authenticated-role grant either. A snapshot row is also never updated or
-- deleted once written (immutable history, stricter than social_posts'
-- own "never physically deleted" convention, which at least allows status
-- updates) — no update/delete policy is added for that reason too.
create policy "social_post_metric_snapshots_select_workspace_member"
  on public.social_post_metric_snapshots for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

-- ---------------------------------------------------------------------------
-- social_account_metric_snapshots — one row per (Instagram account, day).
-- ---------------------------------------------------------------------------
--
-- Typed columns are deliberately narrow: SOCIAL-05A's own architecture
-- audit could only OFFICIAL_META_DOC_PROVEN-verify `reach` and
-- `profile_views` at the account level directly against Meta's current
-- documentation (its IG User insights reference page itself returned
-- HTTP 404 for every URL form tried, so the fuller account-metric list
-- remains UNVERIFIED). Per that report's own Phase 5 conservatism
-- instruction, no typed column is added for follower_count,
-- accounts_engaged, total_interactions, reposts, views, or impressions at
-- the account level — any of those, if ever fetched, lives in raw_metrics
-- only until independently, officially re-verified and given its own
-- migration.
--
-- No Instagram identity table exists in this schema (SOCIAL-05A's own
-- Phase 4 finding) — instagram_account_id is the raw Graph API id, not a
-- foreign key.
create table if not exists public.social_account_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  instagram_account_id text not null,
  metric_date date not null,

  reach integer,
  profile_views integer,

  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint social_account_metric_snapshots_unique_per_day unique (workspace_id, instagram_account_id, metric_date)
);

comment on table public.social_account_metric_snapshots is
  'SOCIAL-05C — durable, time-series (one row per Instagram account per day) account-level metric history. Only reach/profile_views are typed columns — every other account metric is officially UNVERIFIED per SOCIAL-05A''s own audit and stays in raw_metrics only until re-verified.';
comment on column public.social_account_metric_snapshots.raw_metrics is
  'Forward-compatibility only: the exact Meta metric values this snapshot captured, for any metric without (or in addition to) a typed column above. Never a token, signed URL, or any other secret — Meta metric values only.';

create index if not exists social_account_metric_snapshots_workspace_date_idx
  on public.social_account_metric_snapshots (workspace_id, metric_date desc);

alter table public.social_account_metric_snapshots enable row level security;

-- Same least-privilege rationale as social_post_metric_snapshots above.
create policy "social_account_metric_snapshots_select_workspace_member"
  on public.social_account_metric_snapshots for select
  to authenticated
  using (public.is_workspace_member(workspace_id));
