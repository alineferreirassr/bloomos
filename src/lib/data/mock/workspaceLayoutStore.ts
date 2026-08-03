import { nowIso } from "@/lib/data/utils";
import type { WorkspaceLayout, WorkspaceWidgetPreference } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 2 — Smart Workspace widget layout. Same shape
 * and same "new instance of the pattern, not a shared store" precedent as
 * `dashboardLayoutStore.ts` (Checkpoint 23, Step 14) — per (workspace,
 * member), mock-only, plain top-level `let`.
 */
let layouts: WorkspaceLayout[] = [];

export function resetWorkspaceLayoutStore(): void {
  layouts = [];
}

function keyOf(workspaceId: string, memberId: string): string {
  return `${workspaceId}:${memberId}`;
}

export function getWorkspaceLayout(workspaceId: string, memberId: string): WorkspaceLayout | null {
  return layouts.find((layout) => keyOf(layout.workspace_id, layout.member_id) === keyOf(workspaceId, memberId)) ?? null;
}

export function saveWorkspaceLayout(workspaceId: string, memberId: string, widgets: WorkspaceWidgetPreference[]): WorkspaceLayout {
  const layout: WorkspaceLayout = { workspace_id: workspaceId, member_id: memberId, widgets, updated_at: nowIso() };
  const existingIndex = layouts.findIndex((entry) => keyOf(entry.workspace_id, entry.member_id) === keyOf(workspaceId, memberId));
  if (existingIndex === -1) layouts = [...layouts, layout];
  else layouts = layouts.map((entry, index) => (index === existingIndex ? layout : entry));
  return layout;
}
