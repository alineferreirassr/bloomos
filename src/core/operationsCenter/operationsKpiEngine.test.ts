import { describe, expect, it } from "vitest";
import { computeOperationalKpis, type KpiSourceData } from "@/core/operationsCenter/operationsKpiEngine";
import type { LiveOperationSummary, OperationalAlert, OperationalIncident, OperationalSnapshot } from "@/types/operationsCenter";
import type { Route, RouteHealthScores, RoutePlan } from "@/types/routeOptimization";

function makeLiveOperations(overrides: Partial<LiveOperationSummary> = {}): LiveOperationSummary {
  return { activeDispatchOrders: 0, pendingAssignments: 0, acceptedAssignments: 0, declinedAssignments: 0, expiredAssignments: 0, activeFieldOperations: 0, pausedFieldOperations: 0, blockedFieldOperations: 0, completedFieldOperations: 0, activeRoutes: 0, highRiskRoutes: 0, ...overrides };
}

function makeSnapshot(overrides: Partial<OperationalSnapshot> = {}): OperationalSnapshot {
  return {
    workspaceId: "ws_1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    confidence: 100,
    sourceOutcomes: [],
    liveOperations: makeLiveOperations(),
    schedulingConflicts: 0,
    capacityAlerts: 0,
    allocationRisks: 0,
    executionPackagesNotReady: 0,
    workersAvailable: 5,
    workersUnavailable: 0,
    equipmentAvailable: 5,
    equipmentUnavailable: 0,
    vehiclesAvailable: 5,
    vehiclesUnavailable: 0,
    criticalExecutiveDecisions: 0,
    blockedObjectives: 0,
    businessHealthScore: 100,
    knowledgeHealthScore: 100,
    recentTimelineActivity: [],
    ...overrides,
  };
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

function makeAlert(overrides: Partial<OperationalAlert> = {}): OperationalAlert {
  return { id: "operational_alert_1", workspace_id: "ws_1", rule_id: "r", category: "dispatch", severity: "critical", title: "", description: "", source_ref: null, source_record_id: null, status: "open", acknowledged_by: null, acknowledged_at: null, resolved_by: null, resolved_at: null, resolution_reason: null, dismissed_at: null, escalated_at: null, expires_at: null, dedupe_key: "k", created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makeIncident(overrides: Partial<OperationalIncident> = {}): OperationalIncident {
  return { id: "operational_incident_1", workspace_id: "ws_1", title: "", description: "", severity: "critical", status: "open", source_alert_ids: [], related_dispatch_order_ids: [], related_field_operation_ids: [], related_route_plan_ids: [], related_worker_ids: [], related_vehicle_ids: [], related_equipment_ids: [], owner_member_id: null, resolution_notes: null, created_at: "2026-01-01T00:00:00.000Z", acknowledged_at: null, resolved_at: null, updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function baseData(overrides: Partial<KpiSourceData> = {}): KpiSourceData {
  return { snapshot: makeSnapshot(), status: "normal", routeResults: [], alerts: [], incidents: [], fieldOperationHealthScores: [], ...overrides };
}

describe("computeOperationalKpis", () => {
  it("is vacuous-safe with entirely empty inputs", () => {
    const kpis = computeOperationalKpis(baseData());
    expect(kpis.declineRate).toBe(0);
    expect(kpis.dispatchQueueHealth).toBe(100);
    expect(kpis.routeHealth).toBe(100);
    expect(kpis.capacityUsage).toBe(0);
    expect(kpis.averageExecutionHealth).toBe(100);
    expect(kpis.overallOperationalStatus).toBe("normal");
  });

  it("computes declineRate as the share of responded assignments that were declined", () => {
    const kpis = computeOperationalKpis(baseData({ snapshot: makeSnapshot({ liveOperations: makeLiveOperations({ acceptedAssignments: 3, declinedAssignments: 1 }) }) }));
    expect(kpis.declineRate).toBe(25);
  });

  it("computes dispatchQueueHealth as the share of decided assignments that were accepted", () => {
    const kpis = computeOperationalKpis(baseData({ snapshot: makeSnapshot({ liveOperations: makeLiveOperations({ acceptedAssignments: 8, declinedAssignments: 1, expiredAssignments: 1 }) }) }));
    expect(kpis.dispatchQueueHealth).toBe(80);
  });

  it("averages overallRouteHealth across every real route result", () => {
    const kpis = computeOperationalKpis(baseData({ routeResults: [makeRoute({ health: makeRouteHealth({ overallRouteHealth: 60 }) }), makeRoute({ health: makeRouteHealth({ overallRouteHealth: 80 }) })] }));
    expect(kpis.routeHealth).toBe(70);
  });

  it("computes capacityUsage from the Snapshot's own available/unavailable resource split", () => {
    const kpis = computeOperationalKpis(baseData({ snapshot: makeSnapshot({ workersAvailable: 5, workersUnavailable: 5, equipmentAvailable: 8, equipmentUnavailable: 2, vehiclesAvailable: 9, vehiclesUnavailable: 1 }) }));
    // (5 + 2 + 1) / (10 + 10 + 10) = 8/30 -> 27%
    expect(kpis.capacityUsage).toBe(27);
  });

  it("counts only open/acknowledged/escalated critical alerts, not resolved or dismissed ones", () => {
    const kpis = computeOperationalKpis(baseData({ alerts: [makeAlert({ id: "a1", severity: "critical", status: "open" }), makeAlert({ id: "a2", severity: "critical", status: "resolved" }), makeAlert({ id: "a3", severity: "high", status: "open" })] }));
    expect(kpis.criticalAlerts).toBe(1);
  });

  it("counts only open/acknowledged incidents, not resolved ones", () => {
    const kpis = computeOperationalKpis(baseData({ incidents: [makeIncident({ id: "i1", status: "open" }), makeIncident({ id: "i2", status: "resolved" })] }));
    expect(kpis.openIncidents).toBe(1);
  });

  it("averages reused field operation health scores directly, without recalculating them", () => {
    const kpis = computeOperationalKpis(baseData({ fieldOperationHealthScores: [90, 70] }));
    expect(kpis.averageExecutionHealth).toBe(80);
  });

  it("passes highRiskRoutes, schedulingConflicts, and worker/equipment/vehicle counts straight through from the Snapshot", () => {
    const snapshot = makeSnapshot({ liveOperations: makeLiveOperations({ highRiskRoutes: 3 }), schedulingConflicts: 2, workersAvailable: 4, workersUnavailable: 1, equipmentUnavailable: 2, vehiclesUnavailable: 1 });
    const kpis = computeOperationalKpis(baseData({ snapshot }));
    expect(kpis.highRiskRoutes).toBe(3);
    expect(kpis.schedulingConflicts).toBe(2);
    expect(kpis.availableWorkers).toBe(4);
    expect(kpis.unavailableWorkers).toBe(1);
    expect(kpis.equipmentInUse).toBe(2);
    expect(kpis.vehiclesInUse).toBe(1);
  });
});
