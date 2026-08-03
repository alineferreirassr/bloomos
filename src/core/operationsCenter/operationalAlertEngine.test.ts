import { describe, expect, it } from "vitest";
import { detectOperationalSignals } from "@/core/operationsCenter/operationalAlertEngine";
import type { SnapshotSourceData } from "@/core/operationsCenter/operationalSnapshotEngine";
import type { DispatchOrder, DispatchAssignment } from "@/types/dispatch";
import type { FieldOperation, ExecutionSession } from "@/types/fieldOperations";
import type { Route, RouteHealthScores, RoutePlan } from "@/types/routeOptimization";
import type { SchedulingFinding } from "@/types/scheduling";
import type { AllocationFinding } from "@/types/allocation";
import type { Decision } from "@/types/executiveDecisions";
import type { WorkforceScorecard } from "@/types/workforce";
import type { EquipmentUtilization } from "@/core/workforce/equipmentEngine";
import type { VehicleUtilization } from "@/core/workforce/vehicleEngine";

function emptyData(): SnapshotSourceData {
  return {
    dispatchOrders: null,
    fieldOperations: null,
    routePlans: null,
    routeResults: null,
    schedulingFindings: null,
    allocationFindings: null,
    packageReadinessByPackageId: null,
    workforceScorecard: null,
    equipmentUtilization: null,
    vehicleUtilization: null,
    criticalExecutiveDecisions: null,
    blockedObjectivesCount: null,
    businessHealthScore: null,
    knowledgeHealthScore: null,
    recentTimelineActivity: [],
  };
}

function makeAssignment(overrides: Partial<DispatchAssignment> = {}): DispatchAssignment {
  return { id: "assignment_1", order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "pending", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [], ...overrides };
}

function makeOrder(overrides: Partial<DispatchOrder> = {}): DispatchOrder {
  return { id: "dispatch_order_1", workspace_id: "ws_1", execution_package_id: "package_1", execution_version_id: "version_1", batch_id: null, status: "dispatched", priority: "medium", source: "manual", assignments: [], created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", cancelled_at: null, archived_at: null, ...overrides };
}

function makeSession(overrides: Partial<ExecutionSession> = {}): ExecutionSession {
  return { id: "session_1", field_operation_id: "field_operation_1", lifecycle_state: "started", outcome: null, reason: null, current_phase_id: null, completed_step_ids: [], completed_milestone_ids: [], completed_checklist_item_ids: [], completed_deliverable_ids: [], started_at: "2026-01-01T00:00:00.000Z", paused_at: null, resumed_at: null, completed_at: null, created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", attempts: [], ...overrides };
}

function makeFieldOperation(overrides: Partial<FieldOperation> = {}): FieldOperation {
  return { id: "field_operation_1", workspace_id: "ws_1", dispatch_order_id: "dispatch_order_1", dispatch_assignment_id: "assignment_1", execution_package_id: "package_1", execution_version_id: "version_1", priority: "medium", context: null, status: "active", sessions: [makeSession()], created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null, ...overrides };
}

function makeRoutePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return { id: "route_plan_1", workspace_id: "ws_1", dispatch_order_id: "dispatch_order_1", dispatch_assignment_id: "assignment_1", execution_package_id: "package_1", execution_version_id: "version_1", operational_plan_id: null, priority: "medium", context: null, status: "draft", versions: [], created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", archived_at: null, ...overrides };
}

function makeRouteHealth(overrides: Partial<RouteHealthScores> = {}): RouteHealthScores {
  return { travelHealth: 100, efficiencyHealth: 100, delayRisk: 0, constraintHealth: 100, optimizationHealth: 100, overallRouteHealth: 100, ...overrides };
}

function makeRoute(overrides: Partial<Route> = {}): Route {
  return {
    routePlan: makeRoutePlan(),
    snapshot: { id: "route_snapshot_1", captured_at: "2026-01-01T00:00:00.000Z", waypoints: [], segments: [], travel_legs: [], constraints: [], optimization_result: null },
    validation: { valid: true, errors: [], warnings: [] },
    travelEstimate: { estimatedTravelMinutes: 0, estimatedDistanceKm: 0, estimatedDepartureAt: null, estimatedArrivalAt: null, estimatedIdleMinutes: 0, estimatedTotalDurationMinutes: 0 },
    optimization: null,
    health: makeRouteHealth(),
    explanation: { summary: "", optimizationDecisions: [], rejectedRouteReasons: [], constraintViolations: [], travelEstimateSummary: "", optimizationScoreSummary: "", healthSummary: "" },
    ...overrides,
  };
}

function makeSchedulingFinding(overrides: Partial<SchedulingFinding> = {}): SchedulingFinding {
  return { id: "finding_1", type: "overbooked_schedule", severity: "medium", description: "", relatedCalendarId: null, relatedAppointmentId: null, relatedReservationId: null, ...overrides };
}

function makeAllocationFinding(overrides: Partial<AllocationFinding> = {}): AllocationFinding {
  return { id: "alloc_finding_1", type: "resource_shortage", severity: "high", description: "", relatedRequestId: null, relatedAllocationId: null, relatedResourceId: null, ...overrides };
}

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return { id: "decision_1", workspace_id: "ws_1", title: "", description: "", category: "operations", priority: "critical", status: "open", reason: "", generated_by: "test_engine", created_at: "2026-01-01T00:00:00.000Z", resolved_at: null, resolution_notes: null, related_entities: [], related_assets: [], related_objective_ids: [], related_timeline_activity_ids: [], dependencies: [], dedupe_key: "decision_1", ...overrides };
}

function makeScorecard(overrides: Partial<WorkforceScorecard> = {}): WorkforceScorecard {
  return { totalWorkers: 10, activeWorkers: 8, availableNow: 6, onAssignmentNow: 2, teamsCount: 2, activeAssignments: 3, expiringCertificationsCount: 0, equipmentInUse: 1, vehiclesInUse: 1, activeMobileSessions: 0, evaluatedAt: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makeEquipmentUtilization(overrides: Partial<EquipmentUtilization> = {}): EquipmentUtilization {
  return { totalCount: 5, inUseCount: 1, availableCount: 3, maintenanceCount: 1, retiredCount: 0, ...overrides };
}

function makeVehicleUtilization(overrides: Partial<VehicleUtilization> = {}): VehicleUtilization {
  return { totalCount: 4, inUseCount: 1, availableCount: 2, maintenanceCount: 1, retiredCount: 0, ...overrides };
}

describe("detectOperationalSignals", () => {
  it("produces no signals when every source is empty", () => {
    expect(detectOperationalSignals(emptyData())).toEqual([]);
  });

  it("produces one dispatch signal per assignment, keyed to that exact assignment's own id", () => {
    const data = emptyData();
    data.dispatchOrders = [makeOrder({ assignments: [makeAssignment({ id: "a1", queue_state: "pending" }), makeAssignment({ id: "a2", queue_state: "declined" }), makeAssignment({ id: "a3", queue_state: "expired" })] })];
    const signals = detectOperationalSignals(data);
    const dispatchSignals = signals.filter((s) => s.category === "dispatch");
    expect(dispatchSignals).toHaveLength(3);
    expect(dispatchSignals.map((s) => s.sourceRecordId).sort()).toEqual(["a1", "a2", "a3"]);
    expect(dispatchSignals.find((s) => s.sourceRecordId === "a2")?.ruleId).toBe("dispatch.assignment_declined");
  });

  it("produces distinct field operations signals for blocked vs. paused operations", () => {
    const data = emptyData();
    data.fieldOperations = [
      makeFieldOperation({ id: "fo1", sessions: [makeSession({ lifecycle_state: "aborted" })] }),
      makeFieldOperation({ id: "fo2", sessions: [makeSession({ lifecycle_state: "paused" })] }),
      makeFieldOperation({ id: "fo3", sessions: [makeSession({ lifecycle_state: "started" })] }),
    ];
    const signals = detectOperationalSignals(data).filter((s) => s.category === "field_operations");
    expect(signals).toHaveLength(2);
    expect(signals.find((s) => s.sourceRecordId === "fo1")?.ruleId).toBe("field_operations.operation_blocked");
    expect(signals.find((s) => s.sourceRecordId === "fo2")?.ruleId).toBe("field_operations.operation_paused");
  });

  it("flags a route only once its own declared delay risk crosses the threshold", () => {
    const data = emptyData();
    data.routeResults = [makeRoute({ routePlan: makeRoutePlan({ id: "rp_low" }), health: makeRouteHealth({ delayRisk: 30 }) }), makeRoute({ routePlan: makeRoutePlan({ id: "rp_high" }), health: makeRouteHealth({ delayRisk: 75 }) })];
    const signals = detectOperationalSignals(data).filter((s) => s.category === "route_optimization");
    expect(signals).toHaveLength(1);
    expect(signals[0].sourceRecordId).toBe("rp_high");
  });

  it("produces one scheduling signal per real conflict/capacity finding, ignoring unrelated finding types", () => {
    const data = emptyData();
    data.schedulingFindings = [makeSchedulingFinding({ id: "f1", type: "overbooked_schedule" }), makeSchedulingFinding({ id: "f2", type: "capacity_exhausted" }), makeSchedulingFinding({ id: "f3", type: "reservation_expiration" })];
    const signals = detectOperationalSignals(data).filter((s) => s.category === "scheduling");
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.sourceRecordId).sort()).toEqual(["f1", "f2"]);
  });

  it("only surfaces high-severity allocation findings", () => {
    const data = emptyData();
    data.allocationFindings = [makeAllocationFinding({ id: "af1", severity: "high" }), makeAllocationFinding({ id: "af2", severity: "low" })];
    const signals = detectOperationalSignals(data).filter((s) => s.category === "allocation");
    expect(signals).toHaveLength(1);
    expect(signals[0].sourceRecordId).toBe("af1");
  });

  it("flags every not-ready execution package by its own package id", () => {
    const data = emptyData();
    data.packageReadinessByPackageId = { package_a: { state: "ready", reasons: [] }, package_b: { state: "blocked", reasons: ["missing evidence"] } };
    const signals = detectOperationalSignals(data).filter((s) => s.category === "execution_package");
    expect(signals).toHaveLength(1);
    expect(signals[0].sourceRecordId).toBe("package_b");
    expect(signals[0].severity).toBe("high");
  });

  it("flags low worker availability, equipment shortage, and vehicle shortage independently", () => {
    const data = emptyData();
    data.workforceScorecard = makeScorecard({ totalWorkers: 10, availableNow: 1 });
    data.equipmentUtilization = makeEquipmentUtilization({ totalCount: 3, availableCount: 0 });
    data.vehicleUtilization = makeVehicleUtilization({ totalCount: 2, availableCount: 0 });
    const signals = detectOperationalSignals(data).filter((s) => s.category === "workforce");
    expect(signals.map((s) => s.ruleId).sort()).toEqual(["workforce.equipment_unavailable", "workforce.low_worker_availability", "workforce.vehicle_unavailable"]);
  });

  it("does not flag workforce shortages when availability is healthy", () => {
    const data = emptyData();
    data.workforceScorecard = makeScorecard({ totalWorkers: 10, availableNow: 8 });
    data.equipmentUtilization = makeEquipmentUtilization({ totalCount: 3, availableCount: 1 });
    data.vehicleUtilization = makeVehicleUtilization({ totalCount: 2, availableCount: 1 });
    expect(detectOperationalSignals(data).filter((s) => s.category === "workforce")).toEqual([]);
  });

  it("flags only critical, still-open executive decisions", () => {
    const data = emptyData();
    data.criticalExecutiveDecisions = [makeDecision({ id: "d1", priority: "critical", status: "open" }), makeDecision({ id: "d2", priority: "critical", status: "resolved" }), makeDecision({ id: "d3", priority: "high", status: "open" })];
    const signals = detectOperationalSignals(data).filter((s) => s.category === "executive_decisions");
    expect(signals).toHaveLength(1);
    expect(signals[0].sourceRecordId).toBe("d1");
  });

  it("flags blocked objectives as a single aggregate signal, never one per objective", () => {
    const data = emptyData();
    data.blockedObjectivesCount = 3;
    const signals = detectOperationalSignals(data).filter((s) => s.category === "objectives");
    expect(signals).toHaveLength(1);
    expect(signals[0].description).toContain("3 objectives");
  });

  it("stamps every signal with a non-empty ruleId and occurredAt", () => {
    const data = emptyData();
    data.blockedObjectivesCount = 1;
    const [s] = detectOperationalSignals(data);
    expect(s.ruleId.length).toBeGreaterThan(0);
    expect(s.occurredAt.length).toBeGreaterThan(0);
  });
});
