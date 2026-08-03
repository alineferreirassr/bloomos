import { describe, expect, it } from "vitest";
import { buildPriorityQueue, sortPriorityQueue, type PriorityQueueSourceData } from "@/core/operationsCenter/priorityQueueEngine";
import type { DispatchOrder, DispatchAssignment } from "@/types/dispatch";
import type { FieldOperation, ExecutionSession } from "@/types/fieldOperations";
import type { Route, RouteHealthScores, RoutePlan } from "@/types/routeOptimization";
import type { SchedulingFinding } from "@/types/scheduling";
import type { Decision } from "@/types/executiveDecisions";
import type { OperationalAlert, OperationalIncident } from "@/types/operationsCenter";

function emptyData(): PriorityQueueSourceData {
  return { dispatchOrders: [], fieldOperations: [], routeResults: [], schedulingFindings: [], criticalExecutiveDecisions: [], blockedObjectivesCount: 0, alerts: [], incidents: [], bottlenecks: [] };
}

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
  return { id: "operational_alert_1", workspace_id: "ws_1", rule_id: "r", category: "dispatch", severity: "critical", title: "Alert", description: "", source_ref: null, source_record_id: null, status: "open", acknowledged_by: null, acknowledged_at: null, resolved_by: null, resolved_at: null, resolution_reason: null, dismissed_at: null, escalated_at: null, expires_at: null, dedupe_key: "k", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makeIncident(overrides: Partial<OperationalIncident> = {}): OperationalIncident {
  return { id: "operational_incident_1", workspace_id: "ws_1", title: "Incident", description: "", severity: "critical", status: "open", source_alert_ids: [], related_dispatch_order_ids: [], related_field_operation_ids: [], related_route_plan_ids: [], related_worker_ids: [], related_vehicle_ids: [], related_equipment_ids: [], owner_member_id: null, resolution_notes: null, created_at: "2026-01-01T00:00:00.000Z", acknowledged_at: null, resolved_at: null, updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makeDecision(overrides: Partial<Decision> = {}): Decision {
  return { id: "decision_1", workspace_id: "ws_1", title: "Decision", description: "", category: "operations", priority: "critical", status: "open", reason: "", generated_by: "test", created_at: "2026-01-01T00:00:00.000Z", resolved_at: null, resolution_notes: null, related_entities: [], related_assets: [], related_objective_ids: [], related_timeline_activity_ids: [], dependencies: [], dedupe_key: "d1", ...overrides };
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

function makeAssignment(overrides: Partial<DispatchAssignment> = {}): DispatchAssignment {
  return { id: "assignment_1", order_id: "dispatch_order_1", resource_type: "worker", resource_id: "worker_1", requirement_line_index: 0, queue_state: "pending", reason: null, created_at: "2026-01-01T00:00:00.000Z", responded_at: null, expires_at: null, attempts: [], ...overrides };
}

function makeOrder(overrides: Partial<DispatchOrder> = {}): DispatchOrder {
  return { id: "dispatch_order_1", workspace_id: "ws_1", execution_package_id: "package_1", execution_version_id: "version_1", batch_id: null, status: "dispatched", priority: "medium", source: "manual", assignments: [], created_by: "member_1", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", cancelled_at: null, archived_at: null, ...overrides };
}

function makeSchedulingFinding(overrides: Partial<SchedulingFinding> = {}): SchedulingFinding {
  return { id: "finding_1", type: "overbooked_schedule", severity: "medium", description: "", relatedCalendarId: null, relatedAppointmentId: null, relatedReservationId: null, ...overrides };
}

describe("buildPriorityQueue", () => {
  it("produces nothing from entirely empty sources", () => {
    expect(buildPriorityQueue(emptyData())).toEqual([]);
  });

  it("includes only critical, still-open alerts", () => {
    const data = emptyData();
    data.alerts = [makeAlert({ id: "a1", severity: "critical", status: "open" }), makeAlert({ id: "a2", severity: "high", status: "open" }), makeAlert({ id: "a3", severity: "critical", status: "resolved" })];
    const items = buildPriorityQueue(data).filter((i) => i.type === "alert");
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe("alert:a1");
  });

  it("includes open incidents, blocked field operations, high-risk routes, pending acceptances, and scheduling conflicts", () => {
    const data = emptyData();
    data.incidents = [makeIncident()];
    data.fieldOperations = [makeFieldOperation({ sessions: [makeSession({ lifecycle_state: "aborted" })] })];
    data.routeResults = [makeRoute({ health: makeRouteHealth({ delayRisk: 90 }) })];
    data.dispatchOrders = [makeOrder({ assignments: [makeAssignment({ queue_state: "pending" })] })];
    data.schedulingFindings = [makeSchedulingFinding({ type: "recurring_conflict" })];
    const items = buildPriorityQueue(data);
    expect(items.map((i) => i.type).sort()).toEqual(["acceptance", "incident", "operation", "route", "scheduling_conflict"]);
  });

  it("never re-scores a critical executive decision — it passes the decision's own priority through untouched", () => {
    const data = emptyData();
    data.criticalExecutiveDecisions = [makeDecision({ priority: "critical", status: "open" })];
    const items = buildPriorityQueue(data);
    expect(items).toHaveLength(1);
    expect(items[0].severity).toBe("critical");
  });

  it("excludes resolved/archived executive decisions", () => {
    const data = emptyData();
    data.criticalExecutiveDecisions = [makeDecision({ status: "resolved" })];
    expect(buildPriorityQueue(data)).toEqual([]);
  });

  it("produces a single aggregate objective item when objectives are blocked, never one per objective", () => {
    const data = emptyData();
    data.blockedObjectivesCount = 4;
    const items = buildPriorityQueue(data);
    expect(items).toHaveLength(1);
    expect(items[0].type).toBe("objective");
  });

  it("passes through caller-supplied bottleneck items unchanged", () => {
    const data = emptyData();
    data.bottlenecks = [{ id: "bottleneck:1", type: "bottleneck", severity: "high", title: "Bottleneck", description: "", sourceRef: null, deepLink: null }];
    expect(buildPriorityQueue(data)).toHaveLength(1);
  });
});

describe("sortPriorityQueue", () => {
  it("sorts most severe first", () => {
    const data = emptyData();
    data.alerts = [makeAlert({ id: "a1", severity: "critical" })];
    data.schedulingFindings = [makeSchedulingFinding({ type: "recurring_conflict", severity: "low" })];
    const sorted = sortPriorityQueue(buildPriorityQueue(data));
    expect(sorted[0].type).toBe("alert");
    expect(sorted[sorted.length - 1].type).toBe("scheduling_conflict");
  });
});
