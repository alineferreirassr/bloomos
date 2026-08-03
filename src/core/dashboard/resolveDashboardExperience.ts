import type { WorkspaceMemberRole } from "@/core/enums/workspaceRole";

export const DASHBOARD_EXPERIENCES = ["owner", "team"] as const;

export type DashboardExperience = (typeof DASHBOARD_EXPERIENCES)[number];

/**
 * Checkpoint 19, Step 4 — the Dashboard Experience Resolver. A pure
 * function of the member's own real access-control role
 * (`WorkspaceMemberRole` — owner/admin/manager/staff, the only role
 * vocabulary that actually exists in this codebase; see
 * docs/dashboard-experience-resolver.md for why the checkpoint's own
 * broader role list — Planner/Coordinator/Designer/etc. — is modeled
 * separately as `TeamRoleLabel`, a cosmetic label, never a second
 * access-control system).
 *
 * `owner` and `admin` see the Owner Dashboard (business-wide visibility —
 * an Admin is trusted with the same operational breadth as the Owner in
 * this codebase's existing permission model, see `WORKSPACE_MANAGEMENT_ROLES`
 * in `core/enums/workspaceRole.ts`). `manager` and `staff` see the Team
 * Dashboard, further varied by their own `TeamRoleLabel` (Step 8).
 *
 * The Client Dashboard is resolved separately, by the Client Portal's own
 * session (a Client Account is never a `WorkspaceMemberRole` at all) — see
 * `modules/clientAccess/getClientDashboardData.ts`.
 *
 * Never hardcodes a user name or branches on a route path — exactly the
 * spec's own "do not determine dashboards using hardcoded user names" /
 * "do not rely only on route names."
 */
export function resolveDashboardExperience(role: WorkspaceMemberRole): DashboardExperience {
  return role === "owner" || role === "admin" ? "owner" : "team";
}
