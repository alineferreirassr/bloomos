-- SOCIAL-04B — durable Social post scheduling foundation. Purely additive:
-- extends the existing social_posts table (no parallel scheduling table —
-- SOCIAL-04A's own architecture audit found no mechanical justification for
-- one), widens its status constraint to add 'scheduled', and adds the one
-- privileged claim RPC a background worker (no browser session, no
-- auth.uid()) needs to atomically pick up due posts.
--
-- scheduled_at is the UTC execution instant; scheduled_timezone is a
-- display-only IANA identifier retained for UX, mirroring Event.timezone's
-- own established convention (src/types/event.ts) — execution logic never
-- reads scheduled_timezone. publish_attempts/next_attempt_at back the
-- retry/backoff model (SOCIAL-04A Phase 9): a 'failed' post is only
-- automatically reclaimed by the scheduler if it still carries a
-- scheduled_at (i.e. it originated from the scheduling flow, not a manual
-- Publish Now failure) and hasn't exhausted MAX_PUBLISH_ATTEMPTS (3, kept in
-- sync with src/core/social/socialSchedulingPolicy.ts).

alter table public.social_posts
  add column if not exists scheduled_at timestamptz,
  add column if not exists scheduled_timezone text,
  add column if not exists publish_attempts integer not null default 0,
  add column if not exists next_attempt_at timestamptz;

comment on column public.social_posts.scheduled_at is
  'UTC execution instant for a scheduled post. Null for a post that has never been scheduled. The sole input to due-post selection — never re-interpreted through scheduled_timezone.';
comment on column public.social_posts.scheduled_timezone is
  'IANA timezone identifier captured at scheduling time, display-only (mirrors Event.timezone). Never read by execution logic.';
comment on column public.social_posts.publish_attempts is
  'Incremented once per claim by claim_due_social_posts(). A manually-published post (never claimed by the scheduler) stays at 0.';
comment on column public.social_posts.next_attempt_at is
  'Earliest instant a failed, still-retryable scheduled post becomes claimable again (backoff). Null once a post is terminal (succeeded or exhausted/non-retryable) or was never scheduled.';

alter table public.social_posts drop constraint if exists social_posts_status_check;
alter table public.social_posts add constraint social_posts_status_check
  check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed'));

-- Phase 3 invariants: an impossible state (scheduled with no execution
-- instant, or a negative attempt count) must never silently persist.
-- Existing draft/publishing/published/failed rows are unaffected — neither
-- constraint mentions those statuses, and publish_attempts already defaults
-- to 0 for every pre-existing row.
alter table public.social_posts add constraint social_posts_scheduled_requires_scheduled_at
  check (status <> 'scheduled' or scheduled_at is not null);
alter table public.social_posts add constraint social_posts_publish_attempts_check
  check (publish_attempts >= 0);

-- Due-post selection always filters on (status, scheduled_at) together, and
-- only ever for a post still in a schedulable/retryable status — a partial
-- index scoped to exactly those two statuses stays small and never indexes
-- the (much larger, in a mature workspace) draft/published rows that can
-- never be "due." next_attempt_at is deliberately not part of the index
-- key: it's a low-cardinality secondary filter checked in the RPC's WHERE
-- clause, and adding it here would widen the index for no planner benefit
-- (a workspace has few concurrently-due posts, not enough to need it).
create index if not exists social_posts_due_idx
  on public.social_posts (status, scheduled_at)
  where status in ('scheduled', 'failed');

-- claim_due_social_posts() — the one privileged mutation surface a
-- background scheduler (no auth.uid(), calling through the narrow
-- service-role boundary in socialSchedulerServiceRole.ts) uses. Mirrors
-- reconcile_docusign_envelope_status()'s exact security shape: security
-- definer, search_path pinned, service_role-only.
--
-- FOR UPDATE SKIP LOCKED is the standard Postgres multi-row claim idiom —
-- two concurrent invocations (e.g. an overlapping cron tick) each lock and
-- claim disjoint rows rather than racing over the same batch, and the
-- claiming UPDATE itself (status -> 'publishing') is what makes a claim
-- exclusive: a post already 'publishing' never matches this function's own
-- WHERE clause again, so a second concurrent claim attempt simply finds it
-- gone from the eligible set.
--
-- A 'failed' row is only eligible here if it still carries a scheduled_at
-- (proving it came from the scheduling flow, not a manual Publish Now
-- failure a human must retry by hand) and scheduled_at <= now() — the same
-- column that gated its very first claim also gates every retry.
create or replace function public.claim_due_social_posts(p_limit integer default 10)
returns setof public.social_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.social_posts
  set status = 'publishing',
      publish_attempts = publish_attempts + 1,
      updated_at = now()
  where id in (
    select id
    from public.social_posts
    where status in ('scheduled', 'failed')
      and scheduled_at is not null
      and scheduled_at <= now()
      and (next_attempt_at is null or next_attempt_at <= now())
      and publish_attempts < 3
    order by scheduled_at asc
    limit greatest(p_limit, 0)
    for update skip locked
  )
  returning *;
end;
$$;

comment on function public.claim_due_social_posts(integer) is
  'Security definer, service_role only: atomically claims up to p_limit due/retry-eligible social_posts rows (scheduled or failed-with-scheduled_at, scheduled_at <= now(), backoff/attempt-limit satisfied), transitioning each to publishing and incrementing publish_attempts. FOR UPDATE SKIP LOCKED guarantees two concurrent callers never claim the same row.';

-- This project's public schema has a default-privilege rule
-- (ALTER DEFAULT PRIVILEGES ... GRANT EXECUTE ON FUNCTIONS TO anon,
-- authenticated, service_role) that auto-grants anon/authenticated execute
-- on every newly-created function regardless of `revoke all from public` —
-- mechanically confirmed via pg_default_acl during GMAIL-OAUTH-CONFIG-01's
-- own audit, and the exact reason reconcile_docusign_envelope_status
-- needed a separate live REVOKE after its own migration ran. Revoking both
-- roles explicitly, in this migration, closes that gap at creation time
-- instead of requiring a follow-up live patch.
revoke all on function public.claim_due_social_posts(integer) from public;
revoke execute on function public.claim_due_social_posts(integer) from anon;
revoke execute on function public.claim_due_social_posts(integer) from authenticated;
grant execute on function public.claim_due_social_posts(integer) to service_role;

-- reclaim_abandoned_social_posts() — SOCIAL-04A Phase 16's crash/lease
-- recovery: a worker that claims a post (-> 'publishing') and then crashes
-- (function timeout, uncaught exception) before reaching a terminal state
-- must not leave that post stuck in 'publishing' forever. A post is only
-- "abandoned" once its own updated_at is older than the caller-supplied
-- lease window (see socialSchedulingPolicy.ts's getClaimLeaseMs() — an
-- env-overridable app constant, since this project's actual Vercel function
-- execution-duration limit isn't mechanically verifiable from repository
-- evidence). Reclaiming means reverting to 'failed' with next_attempt_at
-- cleared to null — the row becomes eligible again exactly like any other
-- failed post: through claim_due_social_posts()'s own existing
-- scheduled_at/attempt-limit logic if it was schedule-originated, or left
-- for a human to retry via Publish Now if it wasn't (scheduled_at is null).
-- provider_container_id and publish_attempts are never touched here — a
-- reclaimed post must still be able to safely reuse (or refuse to blindly
-- reuse — see socialPublishExecution.ts's own unsafe-retry guard) whatever
-- container a prior, now-abandoned attempt already created, and its own
-- attempt count must keep counting toward the same MAX_PUBLISH_ATTEMPTS
-- ceiling, not restart.
create or replace function public.reclaim_abandoned_social_posts(p_lease_seconds integer default 600)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.social_posts
  set status = 'failed', next_attempt_at = null, updated_at = now()
  where status = 'publishing'
    and updated_at <= now() - make_interval(secs => greatest(p_lease_seconds, 0));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

comment on function public.reclaim_abandoned_social_posts(integer) is
  'Security definer, service_role only: reverts any social_posts row stuck in publishing for longer than p_lease_seconds back to failed (next_attempt_at cleared, provider_container_id/publish_attempts untouched), so a crashed worker''s claim is not permanent. Returns the number of rows reclaimed.';

revoke all on function public.reclaim_abandoned_social_posts(integer) from public;
revoke execute on function public.reclaim_abandoned_social_posts(integer) from anon;
revoke execute on function public.reclaim_abandoned_social_posts(integer) from authenticated;
grant execute on function public.reclaim_abandoned_social_posts(integer) to service_role;
