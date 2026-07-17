/**
 * The canonical internal Workspace role model — see the Team foundation
 * migrations (`supabase/migrations/20260724100000_roles.sql` onward) and
 * `docs/permissions.md`. Replaces the Supabase Foundation phase's
 * placeholder set ('owner'/'admin'/'manager'/'team'/'viewer'), which was
 * never implemented beyond its own enum definition — no RLS policy, no
 * application code, and no live data ever referenced 'team' or 'viewer'.
 */
export const WORKSPACE_MEMBER_ROLES = ["owner", "admin", "manager", "staff"] as const;

export type WorkspaceMemberRole = (typeof WORKSPACE_MEMBER_ROLES)[number];

export const WORKSPACE_MEMBER_ROLE_LABELS: Record<WorkspaceMemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

/** Roles the "workspaces_update_owner_admin" RLS policy grants write access to — see supabase/migrations. Team-member management itself is now permission-gated (team.manage_roles), not role-array-gated — see lib/team/permissions.ts. */
export const WORKSPACE_MANAGEMENT_ROLES: WorkspaceMemberRole[] = ["owner", "admin"];
