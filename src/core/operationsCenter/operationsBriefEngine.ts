import type { OperationalIncident, OperationalKpiSnapshot, OperationalSnapshot, OperationalStatus, OperationsBrief, PriorityQueueItem } from "@/types/operationsCenter";

/**
 * v2.0 Checkpoint 31, Step 16 — Deterministic Operations Brief. Plain
 * template sentences assembled from already-computed data (the
 * Snapshot, the Status Engine, the KPI Engine, the Priority Queue, open
 * Incidents) — no external AI provider, no generated facts. If Bloom AI
 * ever surfaces this brief, it must display this result verbatim rather
 * than generating its own summary from raw data.
 *
 * `recentImprovements`/`recentRegressions` compare the current KPI
 * snapshot against a previous one the caller supplies — Operations
 * Center keeps no history of its own (everything else here is computed
 * fresh on every read), so without a `previousKpis` to diff against
 * these stay empty rather than fabricating a trend.
 */
export interface BriefSourceData {
  snapshot: OperationalSnapshot;
  status: OperationalStatus;
  kpis: OperationalKpiSnapshot;
  priorityQueue: PriorityQueueItem[];
  openIncidents: OperationalIncident[];
  previousKpis: OperationalKpiSnapshot | null;
}

const TOP_PRIORITIES_LIMIT = 5;

function diffLine(label: string, previous: number, current: number, lowerIsBetter: boolean): string | null {
  if (previous === current) return null;
  const improved = lowerIsBetter ? current < previous : current > previous;
  if (!improved) return null;
  return `${label} improved from ${previous} to ${current}.`;
}

function regressionLine(label: string, previous: number, current: number, lowerIsBetter: boolean): string | null {
  if (previous === current) return null;
  const regressed = lowerIsBetter ? current > previous : current < previous;
  if (!regressed) return null;
  return `${label} went from ${previous} to ${current}.`;
}

export function computeOperationsBrief(data: BriefSourceData, now: string): OperationsBrief {
  const { snapshot, kpis, priorityQueue, openIncidents } = data;

  const currentOperationalSummary = `Status: ${data.status}. ${kpis.activeOperations} active operation${kpis.activeOperations === 1 ? "" : "s"}, ${kpis.pendingAcceptances} pending acceptance${kpis.pendingAcceptances === 1 ? "" : "s"}, ${kpis.criticalAlerts} critical alert${kpis.criticalAlerts === 1 ? "" : "s"}, ${kpis.openIncidents} open incident${kpis.openIncidents === 1 ? "" : "s"}.`;

  const criticalIssues = priorityQueue.filter((i) => i.severity === "critical").map((i) => i.title);

  const blockedWork = priorityQueue.filter((i) => i.type === "operation").map((i) => i.description);
  const highRiskRoutes = priorityQueue.filter((i) => i.type === "route").map((i) => i.description);

  const capacityRisks: string[] = [];
  if (kpis.schedulingConflicts > 0) capacityRisks.push(`${kpis.schedulingConflicts} scheduling conflict${kpis.schedulingConflicts === 1 ? "" : "s"}.`);
  if (kpis.capacityUsage >= 90) capacityRisks.push(`Combined resource capacity usage is at ${kpis.capacityUsage}%.`);
  if (snapshot.workersAvailable + snapshot.workersUnavailable > 0 && snapshot.workersAvailable / (snapshot.workersAvailable + snapshot.workersUnavailable) < 0.2) capacityRisks.push("Fewer than 20% of workers are currently available.");

  const resourceAvailabilitySummary = `${kpis.availableWorkers} of ${kpis.availableWorkers + kpis.unavailableWorkers} workers available; ${kpis.equipmentInUse} equipment item${kpis.equipmentInUse === 1 ? "" : "s"} in use; ${kpis.vehiclesInUse} vehicle${kpis.vehiclesInUse === 1 ? "" : "s"} in use.`;

  const topPriorities = priorityQueue.slice(0, TOP_PRIORITIES_LIMIT).map((i) => i.title);

  const recentImprovements: string[] = [];
  const recentRegressions: string[] = [];
  if (data.previousKpis) {
    const prev = data.previousKpis;
    const comparisons: Array<[string, number, number, boolean]> = [
      ["Decline rate", prev.declineRate, kpis.declineRate, true],
      ["Dispatch queue health", prev.dispatchQueueHealth, kpis.dispatchQueueHealth, false],
      ["Route health", prev.routeHealth, kpis.routeHealth, false],
      ["Critical alerts", prev.criticalAlerts, kpis.criticalAlerts, true],
      ["Open incidents", prev.openIncidents, kpis.openIncidents, true],
      ["Average execution health", prev.averageExecutionHealth, kpis.averageExecutionHealth, false],
    ];
    for (const [label, previous, current, lowerIsBetter] of comparisons) {
      const improvement = diffLine(label, previous, current, lowerIsBetter);
      if (improvement) recentImprovements.push(improvement);
      const regression = regressionLine(label, previous, current, lowerIsBetter);
      if (regression) recentRegressions.push(regression);
    }
  }

  return {
    generatedAt: now,
    currentOperationalSummary,
    criticalIssues,
    pendingAcceptances: kpis.pendingAcceptances,
    blockedWork,
    highRiskRoutes,
    capacityRisks,
    resourceAvailabilitySummary,
    openIncidentsCount: openIncidents.length,
    topPriorities,
    recentImprovements,
    recentRegressions,
  };
}
