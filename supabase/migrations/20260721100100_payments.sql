-- Finance migration 2 of 8: payments table.
--
-- A single money movement — collected from a Client or paid back to one
-- (refund). Mirrors src/types/payment.ts exactly. invoice_id is
-- deliberately nullable (a Payment may exist without an Invoice, e.g. a
-- deposit collected before one is issued), but client_id/workspace_id are
-- always required.
--
-- Refunds are represented as a new Payment row (payment_type = 'refund'),
-- never a second ledger — the refundable ceiling against an original
-- Payment is tracked entirely through the `reference` column's
-- 'refund_of:{original_payment_id}' string convention (see
-- process_payment_refund, migration 8), not a dedicated foreign key. This
-- mirrors the mock's exact mechanism (refundReferenceFor in
-- lib/data/index.ts) — preserved as-is, not redesigned.
--
-- amount_minor is always positive (including for refund rows) — an integer
-- minor-unit amount, same rationale as invoices.*_minor.
--
-- Never stores card numbers, bank account numbers, or any other sensitive
-- payment credential — reference is free-text only (a check number, a
-- provider transaction id, or the refund-tracking convention above).

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  client_id uuid not null references public.clients (id),
  event_id uuid references public.events (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  payment_type text not null,
  status text not null,
  amount_minor integer not null,
  currency text not null default 'USD',
  payment_method text not null,
  reference text,
  transaction_date date not null,
  received_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  notes text,
  document_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_payment_type_check check (
    payment_type in (
      'deposit', 'installment', 'final_payment', 'full_payment', 'retainer',
      'reimbursement', 'refund', 'adjustment', 'other'
    )
  ),
  constraint payments_status_check check (
    status in ('pending', 'processing', 'succeeded', 'failed', 'partially_refunded', 'refunded', 'cancelled')
  ),
  constraint payments_payment_method_check check (
    payment_method in (
      'cash', 'check', 'bank_transfer', 'ach', 'credit_card', 'debit_card',
      'zelle', 'venmo', 'paypal', 'stripe', 'square', 'other'
    )
  ),
  constraint payments_currency_check check (char_length(currency) = 3),
  constraint payments_amount_check check (amount_minor > 0)
);

comment on table public.payments is
  'A single money movement — collected from or refunded to a Client. Mirrors src/types/payment.ts. Refunds are Payments with payment_type=refund, tracked back to their original via the reference column, never a second ledger. document_id is a placeholder for the future Media Library integration — always null today.';
