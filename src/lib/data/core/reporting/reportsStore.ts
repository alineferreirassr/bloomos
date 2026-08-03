import type { SavedReport, ReportDefinition } from "@/types/reporting";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 42 — one row per saved report, the same "in-memory array, workspace-scoped by field, never a second workspace-partitioning scheme" shape every other mock store in this codebase already uses. */
let reports: SavedReport[] = [];

/** Test-only: restore the store to empty between test cases. */
export function resetReportsStore(): void {
  reports = [];
}

export async function listReports(workspaceId: string, includeArchived = false): Promise<SavedReport[]> {
  return reports.filter((r) => r.workspace_id === workspaceId && (includeArchived || r.archived_at === null)).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export async function getReport(workspaceId: string, id: string): Promise<SavedReport | null> {
  return reports.find((r) => r.workspace_id === workspaceId && r.id === id) ?? null;
}

export interface CreateReportInput extends ReportDefinition {
  sourceTemplateId?: string | null;
}

export async function createReport(workspaceId: string, memberId: string, input: CreateReportInput): Promise<DataResult<SavedReport>> {
  if (input.title.trim().length === 0) return fail("Please fix the highlighted fields.", { title: "Title is required" });
  const now = nowIso();
  const report: SavedReport = {
    ...input,
    id: generateId("report"),
    workspace_id: workspaceId,
    created_by_member_id: memberId,
    created_at: now,
    updated_at: now,
    archived_at: null,
    source_template_id: input.sourceTemplateId ?? null,
  };
  reports = [...reports, report];
  return ok(report);
}

export async function updateReport(workspaceId: string, id: string, patch: Partial<ReportDefinition>): Promise<DataResult<SavedReport>> {
  const existing = reports.find((r) => r.workspace_id === workspaceId && r.id === id);
  if (!existing) return fail("Report not found.");
  const updated: SavedReport = { ...existing, ...patch, updated_at: nowIso() };
  reports = reports.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

export async function archiveReport(workspaceId: string, id: string): Promise<DataResult<SavedReport>> {
  const existing = reports.find((r) => r.workspace_id === workspaceId && r.id === id);
  if (!existing) return fail("Report not found.");
  const updated: SavedReport = { ...existing, archived_at: existing.archived_at ?? nowIso(), updated_at: nowIso() };
  reports = reports.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

export async function restoreReport(workspaceId: string, id: string): Promise<DataResult<SavedReport>> {
  const existing = reports.find((r) => r.workspace_id === workspaceId && r.id === id);
  if (!existing) return fail("Report not found.");
  const updated: SavedReport = { ...existing, archived_at: null, updated_at: nowIso() };
  reports = reports.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}
