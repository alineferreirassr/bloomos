import type { Database } from "@/types/database.types";
import type { Profile } from "@/types/profile";
import type { Workspace } from "@/types/workspace";
import type { WorkspaceMember } from "@/types/workspaceMember";
import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { WorkspaceMemberStatus } from "@/core/enums/workspaceMemberStatus";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceMemberRow = Database["public"]["Tables"]["workspace_members"]["Row"];

/**
 * Deliberate seam between raw database rows and domain types, even though
 * the shapes are ~identical today — this is where future column renames or
 * derived fields get absorbed without leaking the DB shape into callers.
 * Never pass a raw *Row straight through application code; always go
 * through one of these.
 */
export function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    avatar_url: row.avatar_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function mapWorkspaceRow(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at,
  };
}

export function mapWorkspaceMemberRow(row: WorkspaceMemberRow): WorkspaceMember {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    user_id: row.user_id,
    role: row.role as WorkspaceMemberRole,
    status: row.status as WorkspaceMemberStatus,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
