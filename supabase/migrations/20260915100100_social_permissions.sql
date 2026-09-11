-- SOCIAL-03 — seeds the smallest real Social Post permission set into the
-- live `permissions`/`role_permissions` tables, mirroring
-- `src/lib/team/permissionMatrix.ts`'s own grants exactly (the single
-- source of truth for mock mode, where this table doesn't exist): owner
-- and admin get everything, manager gets full create+publish, staff gets
-- view+create only, never publish.
--
-- IMPORTANT, mechanically discovered while writing this migration: the
-- original `20260724101000_team_seed_data.sql`'s own
-- `select 'owner'/'admin', id from public.permissions` grants are a
-- one-time snapshot of whatever permissions existed in the table AT THAT
-- MIGRATION'S APPLY TIME — they are never re-run, so they do NOT
-- automatically cover any permission added by a later migration. Every
-- permission added to `permissionMatrix.ts`/the `Permission` TS enum since
-- Team Foundation (assets.*, communications.*, workforce.*, scheduling.*,
-- proposal_*, reports.*, and many more) was consequently never mirrored
-- into this real table at all — a real, pre-existing, systemic drift
-- between mock-mode's permission matrix and Supabase-mode's actual grants,
-- discovered here, not introduced here. Fixing that entire historical
-- backlog is out of this checkpoint's own scope (it would span dozens of
-- unrelated permissions across the application's full history) and is
-- reported separately rather than silently expanded into here. This
-- migration only guarantees its own three new permissions are correctly,
-- completely seeded for all four roles — never relying on the old
-- migration to have "picked them up."
insert into public.permissions (id, description) values
  ('social.view', 'View social posts'),
  ('social.create', 'Create and edit draft social posts'),
  ('social.publish', 'Publish a social post to a connected provider')
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission_id) values
  ('owner', 'social.view'), ('owner', 'social.create'), ('owner', 'social.publish'),
  ('admin', 'social.view'), ('admin', 'social.create'), ('admin', 'social.publish'),
  ('manager', 'social.view'), ('manager', 'social.create'), ('manager', 'social.publish'),
  ('staff', 'social.view'), ('staff', 'social.create')
on conflict do nothing;
