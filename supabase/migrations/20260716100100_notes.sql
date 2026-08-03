-- Leads migration 2 of 4: notes table.
--
-- Shared, polymorphic table (owner_type + owner_id) reused by every future
-- owner type — mirrors src/types/note.ts and the mock notesStore's
-- architecture exactly (docs/database.md's `notes` section). owner_id is
-- intentionally not a foreign key: it references leads.id today and will
-- reference clients.id/events.id/etc. once those modules migrate, and a
-- single column can't carry a normal FK to more than one target table (see
-- docs/database.md's "Polymorphic ownership" note).
--
-- owner_type is constrained to 'lead' only in this migration — this phase
-- migrates Leads alone. Each future module's own migration phase must widen
-- this CHECK constraint when it adds a real Supabase-backed owner type,
-- exactly as core/enums/entityType.ts grew one value per mock-phase.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  title text not null,
  content text not null,
  category text not null,
  priority text not null,
  is_pinned boolean not null default false,
  -- Metadata-only placeholders ({id, file_name, file_type, size_bytes}) — no
  -- real file storage exists for Notes attachments in this phase.
  attachments jsonb not null default '[]'::jsonb,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notes_owner_type_check check (owner_type in ('lead')),
  constraint notes_category_check check (
    category in (
      'general', 'special_request', 'preference', 'relationship_detail',
      'allergy', 'accessibility', 'dietary_restriction', 'communication',
      'internal_alert', 'idea', 'reminder', 'problem'
    )
  ),
  constraint notes_priority_check check (priority in ('low', 'normal', 'high', 'critical'))
);

comment on table public.notes is
  'Polymorphic notes shared across owner types (owner_type + owner_id). Every query MUST filter by workspace_id together with owner_type/owner_id, never owner_id alone — see docs/database.md.';

create index if not exists notes_workspace_owner_idx on public.notes (workspace_id, owner_type, owner_id);
