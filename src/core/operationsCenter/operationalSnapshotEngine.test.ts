import { describe, expect, it } from "vitest";
import { computeOperationalSnapshot, type SnapshotSourceData } from "@/core/operationsCenter/operationalSnapshotEngine";
import type { DispatchOrder, DispatchAssignment } from "@/types/dispatch";
import type { FieldOperation, ExecutionSession } from "@/types/fieldOperations";
import type { RoutePlan, Route, RouteHealthScores } from "@/types/routeOptimization";
import type { SchedulingFinding } from "@/types/scheduling";
import type { AllocationFinding } from "@/types/allocation";
import type { WorkforceScorecard } from "@/types/workforce";
import type { EquipmentUtilization } from "@/core/workforce/equipmentEngine";
import type { VehicleUtilization } from "@/core/workforce/vehicleEngine";
import type { Decision } from "@/types/executiveDecisions";
import type { TimelineActivity } from "@/types/timelineActivity";

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
  return { id: "alloc_finding_1", type: "resource_shortage", severity: "medium", description: "", relatedRequestId: null, relatedAllocationId: null, relatedResourceId: null, ...overrides };
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

describe("computeOperationalSnapshot", () => {
  it("is vacuous-safe when every source is null/empty", () => {
    const snapshot = computeOperationalSnapshot("ws_1", emptyData(), [], 100);
    expect(snapshot.liveOperations.activeDispatchOrders).toBe(0);
    expect(snapshot.workersAvailable).toBe(0);
    expect(snapshot.workersUnavailable).toBe(0);
    expect(snapshot.businessHealthScore).toBe(100);
    expect(snapshot.knowledgeHealthScore).toBe(100);
    expect(snapshot.recentTimelineActivity).toEqual([]);
  });

  it("derives worker/equipment/vehicle availability from Workforce's own already-computed outputs, never from raw status filtering", () => {
    const data = emptyData();
    data.workforceScorecard = makeScorecard({ totalWorkers: 10, availableNow: 6 });
    data.equipmentUtilization = makeEquipmentUtilization({ totalCount: 5, availableCount: 3 });
    data.vehicleUtilization = makeVehicleUtilization({ totalCount: 4, availableCount: 2 });
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.workersAvailable).toBe(6);
    expect(snapshot.workersUnavailable).toBe(4);
    expect(snapshot.equipmentAvailable).toBe(3);
    expect(snapshot.equipmentUnavailable).toBe(2);
    expect(snapshot.vehiclesAvailable).toBe(2);
    expect(snapshot.vehiclesUnavailable).toBe(2);
  });

  it("counts dispatch orders and assignments by their own real queue states", () => {
    const data = emptyData();
    data.dispatchOrders = [
      makeOrder({
        status: "dispatched",
        assignments: [
          makeAssignment({ id: "a1", queue_state: "pending" }),
          makeAssignment({ id: "a2", queue_state: "accepted" }),
          makeAssignment({ id: "a3", queue_state: "declined" }),
          makeAssignment({ id: "a4", queue_state: "expired" }),
        ],
      }),
      makeOrder({ id: "dispatch_order_2", status: "draft", assignments: [] }),
    ];
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.liveOperations.activeDispatchOrders).toBe(1);
    expect(snapshot.liveOperations.pendingAssignments).toBe(1);
    expect(snapshot.liveOperations.acceptedAssignments).toBe(1);
    expect(snapshot.liveOperations.declinedAssignments).toBe(1);
    expect(snapshot.liveOperations.expiredAssignments).toBe(1);
  });

  it("derives field operation activity from each operation's latest session state", () => {
    const data = emptyData();
    data.fieldOperations = [
      makeFieldOperation({ id: "fo1", status: "active", sessions: [makeSession({ lifecycle_state: "started" })] }),
      makeFieldOperation({ id: "fo2", status: "active", sessions: [makeSession({ lifecycle_state: "paused" })] }),
      makeFieldOperation({ id: "fo3", status: "active", sessions: [makeSession({ lifecycle_state: "aborted" })] }),
      makeFieldOperation({ id: "fo4", status: "completed", sessions: [makeSession({ lifecycle_state: "completed" })] }),
    ];
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.liveOperations.activeFieldOperations).toBe(1);
    expect(snapshot.liveOperations.pausedFieldOperations).toBe(1);
    expect(snapshot.liveOperations.blockedFieldOperations).toBe(1);
    expect(snapshot.liveOperations.completedFieldOperations).toBe(1);
  });

  it("counts active routes and high-risk routes off the route's own declared delay risk", () => {
    const data = emptyData();
    data.routePlans = [makeRoutePlan({ id: "rp1", status: "draft" }), makeRoutePlan({ id: "rp2", status: "archived" })];
    data.routeResults = [makeRoute({ health: makeRouteHealth({ delayRisk: 75 }) }), makeRoute({ health: makeRouteHealth({ delayRisk: 10 }) })];
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.liveOperations.activeRoutes).toBe(1);
    expect(snapshot.liveOperations.highRiskRoutes).toBe(1);
  });

  it("classifies scheduling findings into conflicts vs. capacity alerts by their own real finding type", () => {
    const data = emptyData();
    data.schedulingFindings = [
      makeSchedulingFinding({ type: "overbooked_schedule" }),
      makeSchedulingFinding({ type: "recurring_conflict" }),
      makeSchedulingFinding({ type: "capacity_exhausted" }),
      makeSchedulingFinding({ type: "reservation_expiration" }),
    ];
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.schedulingConflicts).toBe(2);
    expect(snapshot.capacityAlerts).toBe(1);
  });

  it("counts allocation risks and not-ready execution packages directly off their own real results", () => {
    const data = emptyData();
    data.allocationFindings = [makeAllocationFinding(), makeAllocationFinding({ id: "af2" })];
    data.packageReadinessByPackageId = {
      package_1: { state: "ready", reasons: [] },
      package_2: { state: "blocked", reasons: ["missing evidence"] },
    };
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.allocationRisks).toBe(2);
    expect(snapshot.executionPackagesNotReady).toBe(1);
  });

  it("counts only critical-priority executive decisions, never lower-priority ones", () => {
    const data = emptyData();
    data.criticalExecutiveDecisions = [makeDecision({ priority: "critical" }), makeDecision({ id: "decision_2", priority: "high" })];
    const snapshot = computeOperationalSnapshot("ws_1", data, [], 100);
    expect(snapshot.criticalExecutiveDecisions).toBe(1);
  });

  it("passes confidence and source outcomes straight through, and caps recent timeline activity at 25", () => {
    const data = emptyData();
    data.recentTimelineActivity = Array.from(
      { length: 30 },
      (_, i): TimelineActivity => ({ id: `activity_${i}`, workspace_id: "ws_1", owner_type: "event", owner_id: "event_1", type: "dispatch_created", description: "", actor: "member_1", timestamp: "2026-01-01T00:00:00.000Z" }),
    );
    const outcomes = [{ source: "dispatch" as const, state: "successful" as const, data: {}, error: null, fetchedAt: "now" }];
    const snapshot = computeOperationalSnapshot("ws_1", data, outcomes, 82);
    expect(snapshot.confidence).toBe(82);
    expect(snapshot.sourceOutcomes).toBe(outcomes);
    expect(snapshot.recentTimelineActivity).toHaveLength(25);
  });
});
