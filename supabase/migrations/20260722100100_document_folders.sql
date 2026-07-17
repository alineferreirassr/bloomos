-- Documents migration 2 of 8: document_folders table.
--
-- A named container Documents can be filed into, scoped to the same
-- owner_type/owner_id pair as the Documents it holds (a folder never spans
-- multiple owners) — mirrors src/types/documentFolder.ts. Nests via
-- parent_folder_id; cycle prevention and cross-Workspace/cross-owner move
-- rules are enforced in TypeScript (core/workflows/documentFolderWorkflow.ts),
-- not at the DB level, mirroring every other workflow-transition check in
-- this codebase (Contract/Event status transitions are TS-side too).
--
-- Archiving is archived_at-based (no separate status field) and shallow —
-- it does not cascade to child folders or the Documents inside, matching
-- the mock's existing behavior exactly. No delete policy — folders are
-- never physically removed, only archived/restored.

create table if not exists public.document_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  parent_folder_id uuid references public.document_folders (id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  visibility text not null default 'internal',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint document_folders_owner_type_check check (
    owner_type in ('workspace', 'client', 'event', 'contract', 'invoice', 'payment', 'expense')
  ),
  constraint document_folders_visibility_check check (
    visibility in ('internal', 'client', 'team', 'client_and_team', 'restricted')
  ),
  constraint document_folders_sort_order_check check (sort_order >= 0)
);

comment on table public.document_folders is
  'A named container Documents can be filed into, scoped to one owner_type/owner_id pair. Nests via parent_folder_id; cycle prevention is TypeScript-side (core/workflows/documentFolderWorkflow.ts), not a DB constraint.';

-- documents.folder_id -> document_folders(id), added here since
-- document_folders didn't exist yet in migration 1.
alter table public.documents
  add constraint documents_folder_id_fkey
  foreign key (folder_id) references public.document_folders (id) on delete set null;
