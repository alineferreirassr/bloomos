-- Finance Database migration 5 of 11: stripe_webhook_events table.
--
-- The entire idempotency mechanism for Stripe webhook delivery (Stripe may
-- deliver the same event more than once by design): stripe_event_id is
-- unique (enforced in the indexes migration, 10 of 11), and a webhook
-- handler is expected to INSERT ... ON CONFLICT (stripe_event_id) DO NOTHING
-- before doing anything else — a no-op conflict means "already processed,"
-- per the Finance Posting Engine Specification's Stripe reconciliation flow.
--
-- workspace_id is nullable: no Stripe-account-to-workspace mapping exists
-- yet (this is database-layer-only work; no Stripe integration phase has
-- run). This is a known, temporary gap, not an oversight — flagged in the
-- Finance Database Blueprint's Future Compatibility review. It is safe only
-- because this table is never exposed to the `authenticated` role for
-- insert/update (see the RLS migration, 9 of 11) — Stripe is not a logged-in
-- session, so this table's writers are exclusively the service role.
--
-- payload is stored as jsonb (the raw event) for audit/debugging and manual
-- re-processing — no other table in this schema needs to retain a raw
-- external payload, so this is a new, deliberately narrow use of jsonb here.
--
-- journal_entry_id is nullable — only set once a webhook is successfully
-- posted; a `pending` or `failed` row has no linked entry yet.
--
-- No RPC or webhook handler exists yet in this database-only phase — this
-- table exists and is ready, but nothing writes to it until the Stripe
-- Integration phase.

create table if not exists public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null,
  event_type text not null,
  workspace_id uuid references public.workspaces (id) on delete cascade,
  payload jsonb not null,
  posting_status text not null default 'pending',
  journal_entry_id uuid references public.journal_entries (id),
  failure_reason text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,

  constraint stripe_webhook_events_posting_status_check check (posting_status in ('pending', 'posted', 'failed')),
  constraint stripe_webhook_events_stripe_event_id_not_blank_check check (btrim(stripe_event_id) <> ''),
  constraint stripe_webhook_events_event_type_not_blank_check check (btrim(event_type) <> '')
);

comment on table public.stripe_webhook_events is
  'Idempotency ledger for Stripe webhook delivery — stripe_event_id is unique (see the indexes migration). workspace_id is nullable until a Stripe-account-to-workspace mapping exists; safe only because this table is service-role-write-only (see the RLS migration). No webhook handler exists yet — Stripe Integration is a future phase. See docs/finance-ledger.md.';
