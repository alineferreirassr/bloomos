import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";

/**
 * A `workspace_members` row joined with its owning `profiles` row —
 * what the Team Members UI actually needs (name/email/avatar), since
 * WorkspaceMember alone carries none of that. Never a separate table;
 * always assembled at the repository layer.
 */
export interface TeamMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
  status: WorkspaceMemberStatus;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}
