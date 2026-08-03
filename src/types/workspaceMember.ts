import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";

/** Mirrors the `workspace_members` table (supabase/migrations) verbatim (snake_case). Unique on (workspace_id, user_id). */
export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  created_at: string;
  updated_at: string;
}
