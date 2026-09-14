-- SOCIAL-08D — resolves the SOCIAL-08C block-removal gap. SOCIAL-08B's own
-- migration (20260921100000_script_items_foundation.sql) deliberately
-- created no DELETE policy for public.script_blocks, and SOCIAL-08C's own
-- authorization explicitly required real block removal without silently
-- altering that schema/RLS — this checkpoint is the explicit authorization
-- to close that gap.
--
-- Minimum change only: one additional DELETE policy on script_blocks, same
-- workspace-member shape as its existing SELECT/INSERT/UPDATE policies.
-- Nothing else about script_blocks changes (no new column, no soft-delete
-- flag). No DELETE policy is added to script_items or script_versions —
-- both remain archive-only/append-only exactly as SOCIAL-08B designed:
-- physical deletion is authorized for script_blocks alone, matching the
-- Services template family's own precedent of allowing real removal only
-- for a version-scoped child row, never for the parent/version entities
-- themselves.

create policy "script_blocks_delete_workspace_member"
  on public.script_blocks for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
