"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDashboardLayout, saveDashboardLayout } from "@/lib/data/core/analytics/dashboardLayoutStore";
import { EXECUTIVE_DASHBOARD_WIDGET_IDS } from "@/modules/analytics/executive/executiveWidgets";
import type { DashboardLayout, DashboardWidgetPreference } from "@/types/businessIntelligence";

const GENERIC_ACCESS_ERROR = "Dashboard layout isn't available. You may not have access to it.";

export type DashboardLayoutActionResult<T> = { success: true; data: T } | { success: false; error: string };

function defaultLayout(): DashboardWidgetPreference[] {
  return EXECUTIVE_DASHBOARD_WIDGET_IDS.map((widgetId, order) => ({ widgetId, pinned: false, hidden: false, order }));
}

/** v2 Checkpoint 23, Step 14 — Custom Dashboard Widgets. Workspace + member-scoped (see `DashboardLayoutStore`'s own doc comment) — each owner/team member customizes their own Executive Dashboard independently. */
export async function getDashboardLayoutAction(): Promise<DashboardLayoutActionResult<DashboardLayout>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const stored = getDashboardLayout(session.workspace.id, session.membership.id);
  if (stored) return { success: true, data: stored };
  return { success: true, data: { workspace_id: session.workspace.id, member_id: session.membership.id, widgets: defaultLayout(), updated_at: new Date(0).toISOString() } };
}

export async function saveDashboardLayoutAction(widgets: DashboardWidgetPreference[]): Promise<DashboardLayoutActionResult<DashboardLayout>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const validIds = new Set<string>(EXECUTIVE_DASHBOARD_WIDGET_IDS);
  if (widgets.some((w) => !validIds.has(w.widgetId))) return { success: false, error: "Unknown widget id." };

  const layout = saveDashboardLayout(session.workspace.id, session.membership.id, widgets);
  return { success: true, data: layout };
}
