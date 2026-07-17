-- Contracts migration 2 of 8: contracts table.
--
-- Fourth business-module table. Mirrors src/types/contract.ts exactly.
-- client_id is NOT NULL — a Contract always belongs to a Client, the same
-- business rule already enforced in the mock data layer. event_id is
-- nullable — a Contract can stand alone (e.g. a retainer) ahead of or
-- without a dedicated Event record. template_id is nullable and references
-- contract_templates (migration 1).
--
-- status and signature_status are two independent state machines (see
-- core/workflows/contractWorkflow.ts), neither CHECK below encodes a
-- transition rule (that stays application logic, exactly like
-- events.status/lifecycle_stage).
--
-- version_history is a jsonb array of ContractVersionSnapshot objects — the
-- mock's exact "minimal version history" model (a pre-image snapshot
-- appended on every updateContract call), not a separate versions table;
-- preserved as-is per the migration's explicit "do not redesign the
-- version model" instruction.
--
-- Soft delete only (archived_at) — no hard delete policy, reversible via
-- restoreContract(), same precedent as events/clients.
--
-- total_value/deposit_amount/remaining_balance are stored as plain numeric
-- (major-unit currency, e.g. dollars), NOT integer minor-unit cents like
-- Invoice/Payment/Expense — matches contractSchema's z.number() (not an
-- integer-cents transform) and the mock's computeRemainingBalance doing
-- plain subtraction.
--
-- contract_number uniqueness is workspace-scoped (migration 6's unique
-- index), generated via the generate_contract_number() function
-- (migration 8) — collision-safe against concurrent writers via that
-- unique index as the ultimate backstop.

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  event_id uuid references public.events (id) on delete set null,
  template_id uuid references public.contract_templates (id) on delete set null,
  contract_number text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  signature_status text not null default 'unsigned',
  version integer not null default 1,
  version_history jsonb not null default '[]'::jsonb,
  effective_date date,
  expiration_date date,
  signed_at timestamptz,
  sent_at timestamptz,
  viewed_at timestamptz,
  declined_at timestamptz,
  cancelled_at timestamptz,
  archived_at timestamptz,
  total_value numeric,
  deposit_required boolean not null default false,
  deposit_amount numeric,
  remaining_balance numeric,
  currency text not null default 'USD',
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contracts_status_check check (
    status in (
      'draft', 'review', 'ready', 'sent', 'viewed', 'signed', 'completed',
      'expired', 'cancelled', 'archived', 'declined'
    )
  ),
  constraint contracts_signature_status_check check (
    signature_status in (
      'unsigned', 'sent', 'viewed', 'partially_signed', 'signed', 'declined', 'expired', 'cancelled'
    )
  ),
  constraint contracts_currency_check check (char_length(currency) = 3),
  constraint contracts_version_check check (version > 0)
);

comment on table public.contracts is
  'Closes the commercial cycle: Lead -> Client -> Event -> Contract -> Invoice (future) -> Payments (future). Mirrors src/types/contract.ts. Lifecycle rules live in core/workflows/contractWorkflow.ts, not duplicated here.';
