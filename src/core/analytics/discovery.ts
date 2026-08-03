import { listMetrics, listMetricsByCategory } from "@/core/analytics/metricRegistry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { MetricCategory, MetricDefinition } from "@/types/analytics";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ListMetricsForWorkspaceParams {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
  category?: MetricCategory;
}

/**
 * Checkpoint 15, Step 10 — "Workspace scoped, Role aware, Metrics
 * visibility aware." Every metric this member may even be shown, filtered
 * exactly the way `listSkillsForWorkspace`/`listWorkflowNodesForWorkspace`
 * already filter their own registries: `requiredPermissions` (every one
 * must be held), `minimumRole` (a real per-Workspace role check), then
 * `featureFlag` (a real async per-Workspace lookup) — same three gates,
 * same order, same "hidden here would also be denied if computed anyway"
 * property. A KPI Card for Revenue never renders for a member without
 * `finance.view`, matching that module's own access boundary exactly.
 */
export async function listVisibleMetrics(params: ListMetricsForWorkspaceParams): Promise<MetricDefinition[]> {
  const source = params.category ? listMetricsByCategory(params.category) : listMetrics();
  const candidates = source.filter((metric) => {
    if (metric.requiredPermissions.some((permission) => !params.permissions.includes(permission))) return false;
    if (metric.minimumRole && (!params.role || !roleMeetsMinimum(params.role, metric.minimumRole))) return false;
    return true;
  });

  const flagChecks = await Promise.all(
    candidates.map((metric) => (metric.featureFlag ? evaluateFeatureFlag(params.workspaceId, metric.featureFlag) : Promise.resolve(true))),
  );

  return candidates.filter((_, index) => flagChecks[index]);
}
