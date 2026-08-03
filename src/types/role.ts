import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

/** Mirrors the `roles` table (supabase/migrations) verbatim (snake_case). Global, not Workspace-scoped — seeded once, read-only to the app. */
export interface Role {
  id: WorkspaceMemberRole;
  name: string;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
