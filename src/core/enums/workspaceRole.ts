export const WORKSPACE_MEMBER_ROLES = ["owner", "admin", "manager", "team", "viewer"] as const;

export type WorkspaceMemberRole = (typeof WORKSPACE_MEMBER_ROLES)[number];

export const WORKSPACE_MEMBER_ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  team: "Team",
  viewer: "Viewer",
};

/** Roles the "workspaces_update_owner_admin" / "workspace_members_*_owner_admin" RLS policies grant write access to — see supabase/migrations. */
export const WORKSPACE_MANAGEMENT_ROLES: WorkspaceMemberRole[] = ["owner", "admin"];
