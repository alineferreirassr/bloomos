"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkspaceMembers, getVendors, listPurchases } from "@/lib/data";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import { getOperationsReportsData, type VendorPerformanceRow, type InventoryUsageRow } from "@/modules/operations/operationsReportsData";

const GENERIC_ACCESS_ERROR = "Operations Analytics isn't available. You may not have access to it.";

export interface OperationsAnalyticsData {
  /** Distinct `Event.assigned_owner` names among the next 14 days of events (the same bounded population `operationsDashboardData.ts` already computes) divided by total active team members. `null` when there are no active team members yet. */
  teamUtilizationPercent: number | null;
  /** Distinct vendors with a `confirmed` assignment in that same 14-day window, divided by total active vendors. `null` when there are no active vendors yet. */
  vendorUtilizationPercent: number | null;
  vendorPerformance: VendorPerformanceRow[];
  inventoryUsage: InventoryUsageRow[];
  purchaseCount: number;
  /** `null` when the caller lacks `finance.amounts.view` — Phase 08 redaction: purchase cost is an amount-level finance value, gated like every other money figure in Analytics, while the surrounding operational metrics stay available under `analytics.view`. */
  totalPurchaseCostMinor: number | null;
  lateTaskCount: number;
  totalChecklistItemCount: number;
  averageEventHealthScore: number | null;
  /** Same average event health score, restated as a 0-100 "efficiency" figure — one real number, not a second computation, deliberately reused rather than inventing a parallel formula. */
  operationalEfficiencyPercent: number | null;
}

export type GetOperationsAnalyticsDataResult = { success: true; data: OperationsAnalyticsData } | { success: false; error: string };

/** v2 Checkpoint 23, Step 7 — Operations Analytics. Reuses `getOperationsDashboardData` (Checkpoint 21) and `getOperationsReportsData` (Checkpoint 21) wholesale rather than re-fetching or re-deriving anything they already compute; only Team/Vendor Utilization are genuinely new here. */
export async function getOperationsAnalyticsData(): Promise<GetOperationsAnalyticsDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  // Phase 08 — purchase cost is amount-level finance data; the operational metrics stay under
  // `analytics.view`, but the money figure requires `finance.amounts.view` (matching Phase 06B).
  const canViewAmounts = session.permissions.includes("finance.amounts.view");

  const [dashboardData, reportsData, teamMembers, activeVendors, purchases] = await Promise.all([
    getOperationsDashboardData(),
    getOperationsReportsData(),
    getWorkspaceMembers(),
    getVendors({ status: "active" }),
    listPurchases({}),
  ]);

  const activeTeamMembers = teamMembers.filter((member) => member.status === "active");
  const teamUtilizationPercent = activeTeamMembers.length === 0 ? null : (dashboardData.assignedTeamMemberNames.length / activeTeamMembers.length) * 100;
  const vendorUtilizationPercent = activeVendors.length === 0 ? null : (dashboardData.confirmedVendorIds.length / activeVendors.length) * 100;

  const eventScores = dashboardData.eventHealthScores.map((e) => e.score);
  const averageEventHealthScore = eventScores.length === 0 ? null : eventScores.reduce((sum, s) => sum + s, 0) / eventScores.length;

  return {
    success: true,
    data: {
      teamUtilizationPercent,
      vendorUtilizationPercent,
      vendorPerformance: reportsData.vendorPerformance,
      inventoryUsage: reportsData.inventoryUsage,
      purchaseCount: reportsData.purchaseCount,
      totalPurchaseCostMinor: canViewAmounts ? purchases.reduce((sum, p) => sum + p.total_minor, 0) : null,
      lateTaskCount: dashboardData.lateTaskCount,
      totalChecklistItemCount: dashboardData.totalChecklistItemCount,
      averageEventHealthScore,
      operationalEfficiencyPercent: averageEventHealthScore,
    },
  };
}
