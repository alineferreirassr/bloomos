import { listReportMetrics, listReportMetricsByCategory } from "@/core/reporting/metricRegistry";
import { evaluateFeatureFlag } from "@/core/featureFlags";
import { WORKSPACE_MEMBER_ROLES, type WorkspaceMemberRole } from "@/core/enums/workspaceRole";
import type { Permission } from "@/core/enums/permission";
import type { ReportCategory } from "@/types/reporting";
import type { ReportMetricDefinition } from "@/types/reportMetric";

function roleMeetsMinimum(role: WorkspaceMemberRole, minimum: WorkspaceMemberRole): boolean {
  return WORKSPACE_MEMBER_ROLES.indexOf(role) <= WORKSPACE_MEMBER_ROLES.indexOf(minimum);
}

export interface ListReportMetricsForWorkspaceParams {
  workspaceId: string;
  permissions: Permission[];
  role: WorkspaceMemberRole | null;
  category?: ReportCategory;
}

/**
 * v2.0 Checkpoint 42 — the exact same three-gate visibility contract
 * `core/analytics/discovery.ts`'s `listVisibleMetrics()` (Checkpoint 15)
 * already established: `requiredPermissions` (every one held), then
 * `minimumRole`, then `featureFlag` (a real per-workspace lookup). A
 * metric hidden here is a metric the Report Builder's own picker, every
 * report's computation, every snapshot, and every export all agree
 * doesn't exist for this member — "hidden or unauthorized source data
 * must never appear in results/charts/totals/exports/previews" (this
 * checkpoint's own Permissions section) starts at this one gate.
 */
export async function listVisibleReportMetrics(params: ListReportMetricsForWorkspaceParams): Promise<ReportMetricDefinition[]> {
  const source = params.category ? listReportMetricsByCategory(params.category) : listReportMetrics();
  const candidates = source.filter((metric) => {
    if (metric.requiredPermissions.some((permission) => !params.permissions.includes(permission))) return false;
    if (metric.minimumRole && (!params.role || !roleMeetsMinimum(params.role, metric.minimumRole))) return false;
    return true;
  });

  const flagChecks = await Promise.all(candidates.map((metric) => (metric.featureFlag ? evaluateFeatureFlag(params.workspaceId, metric.featureFlag) : Promise.resolve(true))));

  return candidates.filter((_, index) => flagChecks[index]);
}
