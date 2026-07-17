-- Finance migration 3 of 8: expenses table.
--
-- A cost the business incurs — Event-specific, a general business expense
-- (event_id/client_id both null), or supplier/team-related. Mirrors
-- src/types/expense.ts exactly. client_id is the one genuinely-optional
-- required-elsewhere FK in the whole schema — a general business expense
-- has no Client at all, so unlike every other entity workspace_id is not
-- derivable from a required Client.
--
-- supplier_id/team_member_id are forward-looking placeholder columns only
-- — no Supplier or Team module exists yet, so neither gets a foreign key
-- today (same "field exists, no module owns it yet" precedent as Contract
-- Exhibit's document_id).
--
-- amount_minor is always positive, an integer minor-unit amount.
-- reimbursable marks an Expense a team member or supplier fronted and
-- expects to be paid back for — distinct from status: reimbursed, which is
-- *whether* that's actually happened yet.
--
-- Soft delete only (archived_at) — reversible via restoreExpense(), same
-- precedent as every other business-module table.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_id uuid references public.events (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  supplier_id uuid,
  team_member_id uuid,
  category text not null,
  status text not null default 'planned',
  description text not null,
  amount_minor integer not null,
  currency text not null default 'USD',
  transaction_date date not null,
  due_date date,
  paid_at timestamptz,
  reimbursable boolean not null default false,
  reimbursed_at timestamptz,
  reference text,
  notes text,
  document_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint expenses_category_check check (
    category in (
      'decor', 'flowers', 'rentals', 'venue', 'photography', 'video', 'food_beverage',
      'transportation', 'printing', 'supplies', 'inventory', 'team_payroll', 'supplier_payment',
      'marketing', 'software', 'insurance', 'taxes', 'fees', 'travel', 'refund', 'reimbursement',
      'miscellaneous'
    )
  ),
  constraint expenses_status_check check (
    status in ('planned', 'approved', 'due', 'paid', 'reimbursed', 'cancelled', 'archived')
  ),
  constraint expenses_currency_check check (char_length(currency) = 3),
  constraint expenses_amount_check check (amount_minor > 0)
);

comment on table public.expenses is
  'A cost the business incurs — Event-specific, general, or supplier/team-related. Mirrors src/types/expense.ts. supplier_id/team_member_id are unvalidated placeholders for future modules. document_id is a placeholder for the future Media Library integration.';
