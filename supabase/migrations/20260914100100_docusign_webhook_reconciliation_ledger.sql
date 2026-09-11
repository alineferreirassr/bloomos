-- CONTRACTS-03B — durable idempotency ledger for DocuSign webhook
-- reconciliation.
--
-- Purpose: the same verified provider notification delivered N times (a
-- real, expected DocuSign Connect behavior, and the current webhook route
-- has no dedup of its own — see CONTRACTS-03A's own audit) must produce
-- exactly one logical Contract transition, one Timeline entry, and one
-- Workflow trigger dispatch, never N of them. One row here means "this
-- exact (connection, envelope, mapped terminal status) triple has already
-- been successfully reconciled" — a second delivery of the identical
-- notification finds its row already present (via the unique constraint
-- below) and is treated as a safe no-op by
-- reconcile_docusign_envelope_status(), never re-mutating the Contract.
--
-- Internal system infrastructure only — no team member or Client Portal
-- caller ever needs to read or write this table directly. RLS is enabled
-- with deliberately zero policies: only reconcile_docusign_envelope_status()
-- (SECURITY DEFINER, migration 3, granted only to service_role) ever
-- touches it, the same "owner bypasses its own table's RLS" precedent
-- every other SECURITY DEFINER writer in this schema already relies on
-- (e.g. accept_workspace_invitation() inserting into workspace_members).
create table if not exists public.docusign_webhook_reconciliations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  envelope_id text not null,
  mapped_status text not null,
  contract_id uuid references public.contracts (id) on delete set null,
  processed_at timestamptz not null default now(),

  constraint docusign_webhook_reconciliations_mapped_status_check check (mapped_status in ('signed', 'declined')),
  constraint docusign_webhook_reconciliations_unique unique (connection_id, envelope_id, mapped_status)
);

comment on table public.docusign_webhook_reconciliations is
  'CONTRACTS-03B — durable idempotency ledger for DocuSign webhook reconciliation. One row per (connection, envelope, mapped terminal status) triple ever successfully processed. No user-facing RLS policies by design — internal system infrastructure, written only by reconcile_docusign_envelope_status().';

alter table public.docusign_webhook_reconciliations enable row level security;
