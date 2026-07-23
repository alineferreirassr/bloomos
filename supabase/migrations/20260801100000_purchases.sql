-- Purchases migration 1 of 7: purchases table.
--
-- Mirrors src/types/purchase.ts exactly. One entity represents the whole
-- purchase-order lifecycle via `status`, the same "single row through
-- draft-through-terminal-state" shape Invoice already uses, rather than
-- separate order/receipt entities. Line items live in the separate
-- purchase_items table (migration 2), mirroring contract_exhibits'
-- precedent of a real child entity rather than an embedded array.
--
-- vendor_id is a real, required foreign key with no explicit `on delete`
-- clause (defaults to RESTRICT) — the same shape invoices.client_id and
-- events.client_id already use for a required parent that is only ever
-- soft-archived (archived_at), never physically deleted. A Vendor archive
-- never touches this column, so Purchase history is always preserved.
--
-- Every money field is an integer minor-unit amount (cents), matching
-- lib/money.ts and every other monetary column in this schema — never a
-- float. total_minor's consistency with its four inputs is enforced here as
-- an exact-equality CHECK: unlike Invoice's total_minor (derived from a
-- subtraction that historically wasn't pinned down at the DB layer), every
-- input here is a whole-cent integer, so `subtotal + tax + shipping -
-- discount` has no rounding hazard and is safe to enforce as a hard
-- invariant rather than just documented app-layer behavior.
--
-- created_by is free text (matches notes.created_by), not a foreign key to
-- auth.users — the app currently stamps this with a fixed actor label
-- (core/constants/actor.ts's CURRENT_ACTOR), the same convention already
-- used for inventory_movements.performed_by.
--
-- Soft delete only (archived_at) — no deleted_at, no hard delete policy.
-- Every status transition (submit/cancel/archive/restore/receive) goes
-- through a dedicated repository method; the full transition graph itself
-- is intentionally NOT encoded here as a CHECK constraint (see
-- core/workflows/purchaseWorkflow.ts's PURCHASE_TRANSITIONS) — only the
-- single-column "is this a known status" invariant belongs at this layer.

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id),
  purchase_number text not null,
  status text not null default 'draft',
  order_date date,
  expected_delivery_date date,
  actual_received_date date,
  currency text not null default 'USD',
  subtotal_minor integer not null default 0,
  tax_minor integer not null default 0,
  shipping_minor integer not null default 0,
  discount_minor integer not null default 0,
  total_minor integer not null default 0,
  notes text,
  vendor_reference text,
  created_by text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint purchases_status_check check (
    status in ('draft', 'submitted', 'partially_received', 'fully_received', 'cancelled', 'archived')
  ),
  constraint purchases_purchase_number_not_blank_check check (btrim(purchase_number) <> ''),
  constraint purchases_currency_check check (char_length(currency) = 3),
  constraint purchases_subtotal_minor_check check (subtotal_minor >= 0),
  constraint purchases_tax_minor_check check (tax_minor >= 0),
  constraint purchases_shipping_minor_check check (shipping_minor >= 0),
  constraint purchases_discount_minor_check check (discount_minor >= 0),
  constraint purchases_total_minor_check check (total_minor >= 0),
  constraint purchases_total_consistency_check check (
    total_minor = subtotal_minor + tax_minor + shipping_minor - discount_minor
  )
);

comment on table public.purchases is
  'Purchase orders placed with a Vendor. Mirrors src/types/purchase.ts. subtotal_minor/total_minor are always recomputed by the repository from the current purchase_items set — never trusted from caller input. See docs/purchases.md.';
