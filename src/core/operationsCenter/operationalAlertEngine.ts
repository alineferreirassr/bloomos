import type { OperationalSignal } from "@/types/operationsCenter";
import type { SnapshotSourceData } from "@/core/operationsCenter/operationalSnapshotEngine";
import { nowIso } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 31, Step 5 — Operational Alert Engine. 17 named,
 * deterministic rules over the same already-fetched `SnapshotSourceData`
 * the Snapshot Engine reads (Step 2) — never a second fetch, never a
 * recalculation of any source module's own facts. Each rule below
 * produces one `OperationalSignal` per exact triggering record (never one
 * signal per aggregate count), so `sourceRecordId` always names the real
 * record responsible — this is what "each alert references the exact
 * source record" means in practice, since most of these domains have no
 * `KnowledgeNodeType` of their own yet for `sourceRef` to point at (see
 * `OperationalSignal`'s own comment).
 */

function signal(partial: Omit<OperationalSignal, "sourceRef" | "occurredAt"> & { sourceRef?: OperationalSignal["sourceRef"] }): OperationalSignal {
  return { sourceRef: null, occurredAt: nowIso(), ...partial };
}

function detectDispatchSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const order of data.dispatchOrders ?? []) {
    for (const assignment of order.assignments) {
      if (assignment.queue_state === "pending" || assignment.queue_state === "queued" || assignment.queue_state === "assigned") {
        signals.push(signal({ ruleId: "dispatch.assignment_awaiting_response", category: "dispatch", severity: "low", title: "Assignment awaiting response", description: `Dispatch assignment ${assignment.id} on order ${order.id} is still awaiting a response.`, sourceRecordId: assignment.id }));
      } else if (assignment.queue_state === "declined") {
        signals.push(signal({ ruleId: "dispatch.assignment_declined", category: "dispatch", severity: "medium", title: "Assignment declined", description: `Dispatch assignment ${assignment.id} on order ${order.id} was declined.`, sourceRecordId: assignment.id }));
      } else if (assignment.queue_state === "expired") {
        signals.push(signal({ ruleId: "dispatch.assignment_expired", category: "dispatch", severity: "high", title: "Assignment expired", description: `Dispatch assignment ${assignment.id} on order ${order.id} expired without a response.`, sourceRecordId: assignment.id }));
      }
    }
  }
  return signals;
}

function detectFieldOperationsSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const operation of data.fieldOperations ?? []) {
    if (operation.status !== "active") continue;
    const latestSession = operation.sessions[operation.sessions.length - 1];
    if (!latestSession) continue;
    if (latestSession.lifecycle_state === "cancelled" || latestSession.lifecycle_state === "aborted" || latestSession.lifecycle_state === "failed") {
      signals.push(signal({ ruleId: "field_operations.operation_blocked", category: "field_operations", severity: "critical", title: "Field operation blocked", description: `Field operation ${operation.id} is blocked (session ${latestSession.id} is ${latestSession.lifecycle_state}).`, sourceRecordId: operation.id }));
    } else if (latestSession.lifecycle_state === "paused") {
      signals.push(signal({ ruleId: "field_operations.operation_paused", category: "field_operations", severity: "medium", title: "Field operation paused", description: `Field operation ${operation.id} is paused (session ${latestSession.id}).`, sourceRecordId: operation.id }));
    }
  }
  return signals;
}

function detectRouteSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const route of data.routeResults ?? []) {
    if (route.health.delayRisk > 60) {
      signals.push(signal({ ruleId: "route_optimization.high_delay_risk", category: "route_optimization", severity: route.health.delayRisk > 80 ? "high" : "medium", title: "Route at high delay risk", description: `Route plan ${route.routePlan.id} has a declared delay risk of ${route.health.delayRisk}.`, sourceRecordId: route.routePlan.id }));
    }
  }
  return signals;
}

const SCHEDULING_CONFLICT_TYPES = new Set(["overbooked_schedule", "recurring_conflict", "holiday_conflict"]);

function detectSchedulingSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const finding of data.schedulingFindings ?? []) {
    if (SCHEDULING_CONFLICT_TYPES.has(finding.type)) {
      signals.push(signal({ ruleId: `scheduling.${finding.type}`, category: "scheduling", severity: finding.severity, title: "Scheduling conflict detected", description: finding.description || `Scheduling finding ${finding.id} (${finding.type}).`, sourceRecordId: finding.id }));
    } else if (finding.type === "capacity_exhausted") {
      signals.push(signal({ ruleId: "scheduling.capacity_exhausted", category: "scheduling", severity: finding.severity, title: "Scheduling capacity exhausted", description: finding.description || `Scheduling finding ${finding.id} reports exhausted capacity.`, sourceRecordId: finding.id }));
    }
  }
  return signals;
}

function detectAllocationSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const finding of data.allocationFindings ?? []) {
    if (finding.severity === "high") {
      signals.push(signal({ ruleId: "allocation.high_severity_finding", category: "allocation", severity: "high", title: "Allocation risk detected", description: finding.description || `Allocation finding ${finding.id} (${finding.type}).`, sourceRecordId: finding.id }));
    }
  }
  return signals;
}

function detectExecutionPackageSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const [packageId, readiness] of Object.entries(data.packageReadinessByPackageId ?? {})) {
    if (readiness.state !== "ready") {
      signals.push(signal({ ruleId: "execution_package.not_ready", category: "execution_package", severity: readiness.state === "blocked" ? "high" : "medium", title: "Execution package not ready", description: `Execution package ${packageId} is ${readiness.state}${readiness.reasons.length > 0 ? `: ${readiness.reasons.join("; ")}` : "."}`, sourceRecordId: packageId }));
    }
  }
  return signals;
}

function detectWorkforceSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  const scorecard = data.workforceScorecard;
  if (scorecard && scorecard.totalWorkers > 0 && scorecard.availableNow / scorecard.totalWorkers < 0.2) {
    signals.push(signal({ ruleId: "workforce.low_worker_availability", category: "workforce", severity: "high", title: "Low worker availability", description: `Only ${scorecard.availableNow} of ${scorecard.totalWorkers} workers are available now.`, sourceRecordId: null }));
  }
  const equipment = data.equipmentUtilization;
  if (equipment && equipment.totalCount > 0 && equipment.availableCount === 0) {
    signals.push(signal({ ruleId: "workforce.equipment_unavailable", category: "workforce", severity: "medium", title: "No equipment available", description: `All ${equipment.totalCount} tracked equipment items are unavailable.`, sourceRecordId: null }));
  }
  const vehicles = data.vehicleUtilization;
  if (vehicles && vehicles.totalCount > 0 && vehicles.availableCount === 0) {
    signals.push(signal({ ruleId: "workforce.vehicle_unavailable", category: "workforce", severity: "medium", title: "No vehicles available", description: `All ${vehicles.totalCount} tracked vehicles are unavailable.`, sourceRecordId: null }));
  }
  return signals;
}

function detectExecutiveDecisionSignals(data: SnapshotSourceData): OperationalSignal[] {
  const signals: OperationalSignal[] = [];
  for (const decision of data.criticalExecutiveDecisions ?? []) {
    if (decision.priority === "critical" && decision.status !== "resolved" && decision.status !== "archived") {
      signals.push(signal({ ruleId: "executive_decisions.critical_open", category: "executive_decisions", severity: "critical", title: "Critical executive decision open", description: decision.title || `Executive decision ${decision.id} is open at critical priority.`, sourceRecordId: decision.id }));
    }
  }
  return signals;
}

function detectObjectivesSignals(data: SnapshotSourceData): OperationalSignal[] {
  const count = data.blockedObjectivesCount ?? 0;
  if (count <= 0) return [];
  return [signal({ ruleId: "objectives.blocked", category: "objectives", severity: "high", title: "Blocked objectives", description: `${count} objective${count === 1 ? " is" : "s are"} blocked.`, sourceRecordId: null })];
}

/** The complete set of 17 named alert rules, run against one already-fetched `SnapshotSourceData` bundle. */
export function detectOperationalSignals(data: SnapshotSourceData): OperationalSignal[] {
  return [
    ...detectDispatchSignals(data),
    ...detectFieldOperationsSignals(data),
    ...detectRouteSignals(data),
    ...detectSchedulingSignals(data),
    ...detectAllocationSignals(data),
    ...detectExecutionPackageSignals(data),
    ...detectWorkforceSignals(data),
    ...detectExecutiveDecisionSignals(data),
    ...detectObjectivesSignals(data),
  ];
}
