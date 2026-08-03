"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getLeads } from "@/lib/data";
import { COMMERCIAL_COLUMNS, type CommercialColumnId } from "@/modules/pipeline/constants";
import type { Lead } from "@/types/lead";

const GENERIC_ACCESS_ERROR = "Sales Funnel Analytics isn't available. You may not have access to it.";

export interface FunnelStageCount {
  columnId: CommercialColumnId;
  label: string;
  count: number;
}

export interface SalesFunnelData {
  /** Current snapshot — how many leads sit at each working stage right now. Not a cohort/time-series funnel: Lead.status has no persisted transition history (`canTransition` in `leadWorkflow.ts` explicitly allows moving a Lead backward to correct a mistake), so "how many leads have ever reached stage X" isn't derivable — see docs/executive-dashboard.md's Known Limitations. */
  stages: FunnelStageCount[];
  wonCount: number;
  lostCount: number;
  /** Converted / all leads (all-time) — the same definition `clients.conversionRate` (Checkpoint 15) already uses, so this agrees with the existing metric. */
  conversionRatePercent: number;
  /** Converted / (converted + lost) — excludes leads still open, a cleaner "of the ones we've decided, how many did we win" figure. `null` when nothing has been decided yet. */
  decidedWinRatePercent: number | null;
  /** Average days between a converted Lead's `created_at` and `updated_at` — a real proxy for time-to-conversion, not a fabricated figure, though it can be skewed by an unrelated later edit to an already-converted Lead. `null` with no converted leads. */
  averageDaysToConvertLead: number | null;
  /** The working (non-terminal) stage currently holding the most leads — a real "where is the backlog" signal, not a computed cohort drop-off rate. `null` when no leads are in any working stage. */
  mostStalledStage: FunnelStageCount | null;
}

export type GetSalesFunnelDataResult = { success: true; data: SalesFunnelData } | { success: false; error: string };

function daysBetween(startIso: string, endIso: string): number {
  return (new Date(endIso).getTime() - new Date(startIso).getTime()) / (24 * 60 * 60 * 1000);
}

/** v2 Checkpoint 23, Step 4 — Sales Funnel Analytics. Reuses `COMMERCIAL_COLUMNS` (Checkpoint 13's Commercial Pipeline) as the funnel's own stage definitions rather than inventing a second stage list. */
export async function getSalesFunnelData(): Promise<GetSalesFunnelDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("leads.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const leads = await getLeads({ includeArchived: false });

  const stages: FunnelStageCount[] = COMMERCIAL_COLUMNS.filter((column) => column.statuses.length > 0).map((column) => ({
    columnId: column.id,
    label: column.label,
    count: leads.filter((lead: Lead) => column.statuses.includes(lead.status)).length,
  }));

  const wonCount = leads.filter((lead) => lead.status === "converted").length;
  const lostCount = leads.filter((lead) => lead.status === "lost").length;
  const conversionRatePercent = leads.length === 0 ? 0 : (wonCount / leads.length) * 100;
  const decidedCount = wonCount + lostCount;
  const decidedWinRatePercent = decidedCount === 0 ? null : (wonCount / decidedCount) * 100;

  const convertedLeads = leads.filter((lead) => lead.status === "converted");
  const averageDaysToConvertLead = convertedLeads.length === 0 ? null : convertedLeads.reduce((sum, lead) => sum + daysBetween(lead.created_at, lead.updated_at), 0) / convertedLeads.length;

  const mostStalledStage = stages.reduce<FunnelStageCount | null>((max, stage) => (stage.count > 0 && (max === null || stage.count > max.count) ? stage : max), null);

  return {
    success: true,
    data: { stages, wonCount, lostCount, conversionRatePercent, decidedWinRatePercent, averageDaysToConvertLead, mostStalledStage },
  };
}
