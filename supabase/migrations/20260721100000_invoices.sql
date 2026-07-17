-- Finance migration 1 of 8: invoices table.
--
-- Fifth business-module table. Mirrors src/types/invoice.ts exactly.
-- client_id is NOT NULL — an Invoice always belongs to a Client, the same
-- business rule already enforced in the mock data layer. event_id/
-- contract_id are both nullable — a standalone transaction (e.g. a one-off
-- product sale) is a legitimate Invoice, the same "doesn't assume the full
-- chain is populated" precedent Contract established for event_id.
--
-- Unlike Contract, Invoice has no plain status setter — every non-draft
-- status is reached only through its own dedicated data-layer action
-- (issueInvoice, sendInvoice, markInvoiceViewed, markInvoiceOverdue,
-- voidInvoice, archiveInvoice, restoreInvoice) or automatically when a
-- successful Payment is applied (recompute_invoice_balance, migration 8).
--
-- Every money field is an integer minor-unit amount (cents), never
-- numeric/float — see src/lib/money.ts. `integer` (not `bigint`) is
-- sufficient headroom for any realistic single-invoice amount and avoids
-- Postgres bigint's string-serialization gotcha in the JS client.
-- total_minor = subtotal_minor + tax_minor - discount_minor;
-- balance_minor = total_minor - paid_minor, both derived by the data layer
-- (or recompute_invoice_balance) on every create/update/payment
-- application, never independently editable — enforced here by CHECK
-- constraints as a durable backstop against overpayment/negative balance,
-- not just an application-level rule.
--
-- Soft delete only (archived_at) — no hard delete policy, reversible via
-- restoreInvoice(), same precedent as every other business-module table.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  event_id uuid references public.events (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  invoice_number text not null,
  title text not null,
  description text,
  status text not null default 'draft',
  issue_date date,
  due_date date,
  subtotal_minor integer not null,
  tax_minor integer not null default 0,
  discount_minor integer not null default 0,
  total_minor integer not null,
  paid_minor integer not null default 0,
  balance_minor integer not null,
  currency text not null default 'USD',
  notes text,
  sent_at timestamptz,
  viewed_at timestamptz,
  paid_at timestamptz,
  overdue_at timestamptz,
  voided_at timestamptz,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint invoices_status_check check (
    status in ('draft', 'issued', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue', 'voided', 'archived')
  ),
  constraint invoices_currency_check check (char_length(currency) = 3),
  constraint invoices_subtotal_check check (subtotal_minor >= 0),
  constraint invoices_tax_check check (tax_minor >= 0),
  constraint invoices_discount_check check (discount_minor >= 0 and discount_minor <= subtotal_minor),
  constraint invoices_total_check check (total_minor >= 0),
  constraint invoices_paid_check check (paid_minor >= 0 and paid_minor <= total_minor),
  constraint invoices_balance_check check (balance_minor >= 0)
);

comment on table public.invoices is
  'Continues the commercial cycle Contract closes: Lead -> Client -> Event -> Contract -> Invoice -> Payments -> Expenses -> Profit. Mirrors src/types/invoice.ts. Every money field is an integer minor-unit amount — see src/lib/money.ts.';
