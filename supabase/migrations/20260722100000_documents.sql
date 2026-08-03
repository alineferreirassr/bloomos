-- Documents migration 1 of 8: documents table.
--
-- Sixth and final Phase 1 business-module table. Mirrors src/types/document.ts.
-- A Document is business metadata only — the physical file is a MediaAsset
-- (public.media_assets, migration 20260719100000) linked via media_asset_id.
-- No storage_bucket/storage_path/checksum/mime_type/size_bytes/file_name
-- columns exist here; those all live on the linked media_assets row. This
-- is the "Document = metadata, MediaAsset = file" separation approved for
-- this migration — see docs/database.md's Documents section for the full
-- rationale and the git history for the architecture decision writeup.
--
-- Versioning is a parent_document_id + version row-chain, not an in-place
-- update: the first version of a Document is its own chain root
-- (parent_document_id: null, version: 1); every later version points
-- parent_document_id at that same root. Exactly one row in a chain has
-- is_latest_version: true at any time — enforced by create_document_version
-- (migration 8), never toggled by hand.
--
-- owner_type is intentionally narrow (matches VALID_DOCUMENT_OWNER_TYPES in
-- modules/documents/schema.ts) — workspace/client/event/contract/invoice/
-- payment/expense, all of which already have live Supabase tables.
--
-- Soft delete only (status = 'deleted' + deleted_at) — no hard delete
-- policy, matching every other business-module table's precedent.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  folder_id uuid,
  title text not null,
  description text,
  category text not null default 'other',
  status text not null default 'draft',
  visibility text not null default 'internal',
  media_asset_id uuid references public.media_assets (id) on delete set null,
  version integer not null default 1,
  is_latest_version boolean not null default true,
  parent_document_id uuid references public.documents (id) on delete cascade,
  contract_exhibit_id uuid references public.contract_exhibits (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  client_id uuid references public.clients (id) on delete set null,
  contract_id uuid references public.contracts (id) on delete set null,
  invoice_id uuid references public.invoices (id) on delete set null,
  payment_id uuid references public.payments (id) on delete set null,
  expense_id uuid references public.expenses (id) on delete set null,
  uploaded_by uuid references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz,
  archived_at timestamptz,
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint documents_owner_type_check check (
    owner_type in ('workspace', 'client', 'event', 'contract', 'invoice', 'payment', 'expense')
  ),
  constraint documents_category_check check (
    category in (
      'contract', 'signed_contract', 'exhibit', 'proposal', 'invoice', 'receipt',
      'payment_confirmation', 'expense_receipt', 'reimbursement_proof', 'moodboard',
      'inspiration', 'floor_plan', 'event_schedule', 'checklist', 'photo', 'video',
      'identification', 'insurance', 'license', 'tax', 'policy', 'waiver', 'report',
      'internal', 'other'
    )
  ),
  constraint documents_status_check check (
    status in ('draft', 'active', 'superseded', 'expired', 'archived', 'deleted')
  ),
  constraint documents_visibility_check check (
    visibility in ('internal', 'client', 'team', 'client_and_team', 'restricted')
  ),
  constraint documents_version_check check (version > 0)
);

-- folder_id -> document_folders is added in migration 2 (document_folders
-- doesn't exist yet at this point in the ordered sequence).

comment on table public.documents is
  'Business metadata for the single shared file system — the physical file is a MediaAsset (media_assets.id) linked via media_asset_id, never stored inline here. Versioning is a parent_document_id + version row-chain.';
