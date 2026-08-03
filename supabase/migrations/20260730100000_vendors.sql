-- Vendors migration 1 of 5: vendors table.
--
-- Supplier directory — the entity Inventory's primary_vendor_id (reserved,
-- no FK yet — see 20260729100000_inventory_items.sql) will eventually
-- point at, and the future Purchases module will bill against. This
-- migration does not touch inventory_items in any way (no FK added here
-- either) — that wiring is explicitly deferred to a later phase.
--
-- Field shape mirrors Client's own directory-record conventions rather
-- than inventing a new one: address is decomposed into
-- address/city/state/zip_code/country (extending clients.address/city/
-- state/zip_code with one additional nullable column — Vendors, unlike
-- Clients, are commonly international suppliers); is_preferred is a
-- plain boolean flag named like clients.is_vip; notes is a lightweight
-- scalar field distinct from the structured, polymorphic notes table
-- every owner_type already gets (matches inventory_items.notes'
-- precedent); default_currency/char_length(...)=3 mirrors Finance's
-- currency columns (invoices/payments/expenses) exactly.
--
-- status is intentionally only ('active', 'inactive') — a Vendor's
-- archived state is a separate, orthogonal axis (archived_at), matching
-- how every other soft-deleted BloomOS table works and satisfying "no
-- physical DELETE" without overloading status with a third value the way
-- inventory_items' status does. Only company_name is required; every
-- other field is optional, matching the minimal-required/maximal-optional
-- shape every other directory table (Client, Inventory) already follows.

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  company_name text not null,
  display_name text,
  contact_person text,
  email text,
  phone text,
  website text,
  tax_id text,
  address text,
  city text,
  state text,
  zip_code text,
  country text,
  notes text,

  status text not null default 'active',
  tags text[] not null default '{}'::text[],
  default_currency text not null default 'USD',
  payment_terms text,
  is_preferred boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint vendors_status_check check (status in ('active', 'inactive')),
  constraint vendors_currency_check check (char_length(default_currency) = 3)
);

comment on table public.vendors is
  'Supplier directory. Inventory Items may optionally reference a Vendor (inventory_items.primary_vendor_id, no FK yet); the future Purchases module will reference vendors directly. Soft delete only (archived_at) — no physical DELETE.';
