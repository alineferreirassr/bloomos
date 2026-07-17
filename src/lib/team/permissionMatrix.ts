import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import { PERMISSIONS, type Permission } from "@/core/enums/permission";

/**
 * The canonical default role -> permission matrix — must be kept in sync
 * with the seeded `role_permissions` data
 * (`supabase/migrations/20260724101000_team_seed_data.sql`; see that
 * file's comment for the full rationale). This is the single source of
 * truth for mock mode, where there's no `role_permissions` table to query;
 * Supabase mode reads the live table instead of this constant.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<WorkspaceMemberRole, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS,
  manager: [
    "workspace.view",
    "team.view",
    "leads.view",
    "leads.create",
    "leads.update",
    "leads.archive",
    "clients.view",
    "clients.create",
    "clients.update",
    "clients.archive",
    "events.view",
    "events.create",
    "events.update",
    "events.archive",
    "contracts.view",
    "contracts.create",
    "contracts.update",
    "contracts.lifecycle",
    "finance.view",
    "finance.create",
    "finance.update",
    "documents.view",
    "documents.create",
    "documents.update",
    "documents.archive",
  ],
  staff: [
    "workspace.view",
    "team.view",
    "leads.view",
    "clients.view",
    "events.view",
    "contracts.view",
    "finance.view",
    "documents.view",
  ],
};

export function getDefaultRolePermissions(role: WorkspaceMemberRole): Permission[] {
  return [...DEFAULT_ROLE_PERMISSIONS[role]];
}

export function roleHasPermission(role: WorkspaceMemberRole, permission: Permission): boolean {
  return (DEFAULT_ROLE_PERMISSIONS[role] as readonly string[]).includes(permission);
}
