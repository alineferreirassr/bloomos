import type { OperationalAlert, OperationalIncident, OperationalKpiSnapshot, OperationalSnapshot, OperationalStatus } from "@/types/operationsCenter";
import type { Route } from "@/types/routeOptimization";

/**
 * v2.0 Checkpoint 31, Step 9 — Operations KPIs. 18 named figures, every
 * one derived from data this checkpoint already has (the Snapshot, the
 * Status Engine, the live Alert/Incident stores, and Route Optimization's
 * own already-computed per-route health scores) — never a placeholder,
 * never a fabricated number. Where no single already-computed figure
 * exists (`dispatchQueueHealth`, `capacityUsage`), the KPI is a disclosed
 * arithmetic combination of already-real counts, not a new calculation
 * against raw source records.
 */
export interface KpiSourceData {
  snapshot: OperationalSnapshot;
  status: OperationalStatus;
  routeResults: Route[];
  alerts: OperationalAlert[];
  incidents: OperationalIncident[];
  /** Reused directly from Field Operations' own `computeExecutionHealth` output — never recalculated here. */
  fieldOperationHealthScores: number[];
}

function average(values: number[]): number {
  if (values.length === 0) return 100;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeOperationalKpis(data: KpiSourceData): OperationalKpiSnapshot {
  const { snapshot } = data;
  const { liveOperations } = snapshot;

  const totalRespondedAssignments = liveOperations.acceptedAssignments + liveOperations.declinedAssignments;
  const declineRate = totalRespondedAssignments === 0 ? 0 : Math.round((liveOperations.declinedAssignments / totalRespondedAssignments) * 100);

  const totalDecidedAssignments = liveOperations.acceptedAssignments + liveOperations.declinedAssignments + liveOperations.expiredAssignments + liveOperations.pendingAssignments;
  const dispatchQueueHealth = totalDecidedAssignments === 0 ? 100 : Math.round((liveOperations.acceptedAssignments / totalDecidedAssignments) * 100);

  const routeHealth = average(data.routeResults.map((r) => r.health.overallRouteHealth));

  const totalResourceCount = snapshot.workersAvailable + snapshot.workersUnavailable + snapshot.equipmentAvailable + snapshot.equipmentUnavailable + snapshot.vehiclesAvailable + snapshot.vehiclesUnavailable;
  // "Unavailable" is the Snapshot's own coarse proxy for "presumed in use" (it also
  // folds in maintenance/retired, a disclosed limitation of that binary split) — reused
  // here rather than recalculated, consistent with the `equipmentInUse`/`vehiclesInUse`
  // KPIs below using the exact same proxy.
  const inUseResourceCount = snapshot.workersUnavailable + snapshot.equipmentUnavailable + snapshot.vehiclesUnavailable;
  const capacityUsage = totalResourceCount === 0 ? 0 : Math.round((inUseResourceCount / totalResourceCount) * 100);

  const openAlertStates = new Set(["open", "acknowledged", "escalated"]);
  const criticalAlerts = data.alerts.filter((a) => a.severity === "critical" && openAlertStates.has(a.status)).length;
  const openIncidentStates = new Set(["open", "acknowledged"]);
  const openIncidents = data.incidents.filter((i) => openIncidentStates.has(i.status)).length;

  return {
    activeOperations: liveOperations.activeFieldOperations,
    pausedOperations: liveOperations.pausedFieldOperations,
    blockedOperations: liveOperations.blockedFieldOperations,
    pendingAcceptances: liveOperations.pendingAssignments,
    declineRate,
    dispatchQueueHealth,
    routeHealth,
    highRiskRoutes: liveOperations.highRiskRoutes,
    schedulingConflicts: snapshot.schedulingConflicts,
    capacityUsage,
    availableWorkers: snapshot.workersAvailable,
    unavailableWorkers: snapshot.workersUnavailable,
    equipmentInUse: snapshot.equipmentUnavailable,
    vehiclesInUse: snapshot.vehiclesUnavailable,
    criticalAlerts,
    openIncidents,
    averageExecutionHealth: average(data.fieldOperationHealthScores),
    overallOperationalStatus: data.status,
  };
}
