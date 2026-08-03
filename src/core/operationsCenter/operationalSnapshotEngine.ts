import type { LiveOperationSummary, OperationalSnapshot, SourceOutcome } from "@/types/operationsCenter";
import type { DispatchOrder } from "@/types/dispatch";
import type { FieldOperation } from "@/types/fieldOperations";
import type { RoutePlan, Route } from "@/types/routeOptimization";
import type { SchedulingFinding } from "@/types/scheduling";
import type { AllocationFinding } from "@/types/allocation";
import type { PackageReadinessResult } from "@/types/executionPackage";
import type { WorkforceScorecard } from "@/types/workforce";
import type { EquipmentUtilization } from "@/core/workforce/equipmentEngine";
import type { VehicleUtilization } from "@/core/workforce/vehicleEngine";
import type { Decision } from "@/types/executiveDecisions";
import type { TimelineActivity } from "@/types/timelineActivity";

/**
 * v2.0 Checkpoint 31, Step 2 — Operational Snapshot Engine. A pure
 * function over already-fetched, already-typed per-source data (the
 * `Cross-Module Aggregation Engine`'s own job is fetching; this engine
 * never calls a module action or store itself) — deterministic, no
 * randomness, no live re-derivation of any source's own decisions.
 *
 * Worker/Equipment/Vehicle availability is read from Workforce's own
 * already-computed `WorkforceScorecard`/`EquipmentUtilization`/
 * `VehicleUtilization` (via `evaluateWorkforceAction`) rather than
 * re-filtering raw records here — `Worker.status` is an employment
 * lifecycle field, not an availability signal, and Step 12 explicitly
 * forbids performing a new eligibility/availability calculation.
 */

export interface SnapshotSourceData {
  dispatchOrders: DispatchOrder[] | null;
  fieldOperations: FieldOperation[] | null;
  routePlans: RoutePlan[] | null;
  routeResults: Route[] | null;
  schedulingFindings: SchedulingFinding[] | null;
  allocationFindings: AllocationFinding[] | null;
  packageReadinessByPackageId: Record<string, PackageReadinessResult> | null;
  workforceScorecard: WorkforceScorecard | null;
  equipmentUtilization: EquipmentUtilization | null;
  vehicleUtilization: VehicleUtilization | null;
  criticalExecutiveDecisions: Decision[] | null;
  blockedObjectivesCount: number | null;
  businessHealthScore: number | null;
  knowledgeHealthScore: number | null;
  recentTimelineActivity: TimelineActivity[];
}

function computeLiveOperations(data: SnapshotSourceData): LiveOperationSummary {
  const assignments = (data.dispatchOrders ?? []).flatMap((o) => o.assignments);
  const operations = data.fieldOperations ?? [];
  const routeResults = data.routeResults ?? [];

  return {
    activeDispatchOrders: (data.dispatchOrders ?? []).filter((o) => o.status === "dispatched").length,
    pendingAssignments: assignments.filter((a) => a.queue_state === "pending" || a.queue_state === "queued" || a.queue_state === "assigned").length,
    acceptedAssignments: assignments.filter((a) => a.queue_state === "accepted").length,
    declinedAssignments: assignments.filter((a) => a.queue_state === "declined").length,
    expiredAssignments: assignments.filter((a) => a.queue_state === "expired").length,
    activeFieldOperations: operations.filter((o) => o.sessions[o.sessions.length - 1]?.lifecycle_state === "started" || o.sessions[o.sessions.length - 1]?.lifecycle_state === "resumed").length,
    pausedFieldOperations: operations.filter((o) => o.sessions[o.sessions.length - 1]?.lifecycle_state === "paused").length,
    blockedFieldOperations: operations.filter((o) => o.status === "active" && ["cancelled", "aborted", "failed"].includes(o.sessions[o.sessions.length - 1]?.lifecycle_state ?? "")).length,
    completedFieldOperations: operations.filter((o) => o.status === "completed").length,
    activeRoutes: (data.routePlans ?? []).filter((p) => p.status !== "archived").length,
    highRiskRoutes: routeResults.filter((r) => r.health.delayRisk > 60).length,
  };
}

export function computeOperationalSnapshot(workspaceId: string, data: SnapshotSourceData, sourceOutcomes: SourceOutcome<unknown>[], confidence: number): OperationalSnapshot {
  const workersAvailable = data.workforceScorecard?.availableNow ?? 0;
  const workersUnavailable = Math.max(0, (data.workforceScorecard?.totalWorkers ?? 0) - workersAvailable);
  const equipmentAvailable = data.equipmentUtilization?.availableCount ?? 0;
  const equipmentUnavailable = Math.max(0, (data.equipmentUtilization?.totalCount ?? 0) - equipmentAvailable);
  const vehiclesAvailable = data.vehicleUtilization?.availableCount ?? 0;
  const vehiclesUnavailable = Math.max(0, (data.vehicleUtilization?.totalCount ?? 0) - vehiclesAvailable);

  return {
    workspaceId,
    generatedAt: new Date().toISOString(),
    confidence,
    sourceOutcomes,
    liveOperations: computeLiveOperations(data),
    schedulingConflicts: (data.schedulingFindings ?? []).filter((f) => f.type === "overbooked_schedule" || f.type === "recurring_conflict" || f.type === "holiday_conflict" || f.type === "unavailable_time_window").length,
    capacityAlerts: (data.schedulingFindings ?? []).filter((f) => f.type === "capacity_exhausted").length,
    allocationRisks: (data.allocationFindings ?? []).length,
    executionPackagesNotReady: Object.values(data.packageReadinessByPackageId ?? {}).filter((r) => r.state !== "ready").length,
    workersAvailable,
    workersUnavailable,
    equipmentAvailable,
    equipmentUnavailable,
    vehiclesAvailable,
    vehiclesUnavailable,
    criticalExecutiveDecisions: (data.criticalExecutiveDecisions ?? []).filter((d) => d.priority === "critical").length,
    blockedObjectives: data.blockedObjectivesCount ?? 0,
    businessHealthScore: data.businessHealthScore ?? 100,
    knowledgeHealthScore: data.knowledgeHealthScore ?? 100,
    recentTimelineActivity: data.recentTimelineActivity.slice(0, 25),
  };
}
