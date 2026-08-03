/**
 * Mirrors the `workspaces` table (supabase/migrations) verbatim (snake_case).
 * The MVP UI assumes a single active Workspace per session (`CURRENT_WORKSPACE_ID`,
 * `core/constants/workspace.ts`), but this schema supports many per user —
 * see BLOOMOS_BIBLE.md §7.
 */
export interface Workspace {
  id: string;
  name: string;
  slug: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
