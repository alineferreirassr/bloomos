import { nowIso } from "@/lib/data/utils";
import type { DashboardLayout, DashboardWidgetPreference } from "@/types/businessIntelligence";

/**
 * v2 Checkpoint 23, Step 14 — Custom Dashboard Widgets. Mock-only, same
 * "new checkpoint domain, mock-only this phase, plain top-level `let`"
 * precedent `webhookEndpointStore.ts` establishes — every touch point here
 * is a Server Action reached from the Executive Dashboard, never a Route
 * Handler. Keyed by `workspace_id` + `member_id` (per-member, not
 * workspace-wide) — each owner/team member can pin/hide/reorder their own
 * Executive Dashboard independently.
 */
let layouts: DashboardLayout[] = [];

export function resetDashboardLayoutStore(): void {
  layouts = [];
}

function keyOf(workspaceId: string, memberId: string): string {
  return `${workspaceId}:${memberId}`;
}

export function getDashboardLayout(workspaceId: string, memberId: string): DashboardLayout | null {
  return layouts.find((layout) => keyOf(layout.workspace_id, layout.member_id) === keyOf(workspaceId, memberId)) ?? null;
}

export function saveDashboardLayout(workspaceId: string, memberId: string, widgets: DashboardWidgetPreference[]): DashboardLayout {
  const layout: DashboardLayout = { workspace_id: workspaceId, member_id: memberId, widgets, updated_at: nowIso() };
  const existingIndex = layouts.findIndex((entry) => keyOf(entry.workspace_id, entry.member_id) === keyOf(workspaceId, memberId));
  if (existingIndex === -1) layouts = [...layouts, layout];
  else layouts = layouts.map((entry, index) => (index === existingIndex ? layout : entry));
  return layout;
}
