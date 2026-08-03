import { describe, expect, it } from "vitest";
import { computeOperationsBrief, type BriefSourceData } from "@/core/operationsCenter/operationsBriefEngine";
import type { LiveOperationSummary, OperationalIncident, OperationalKpiSnapshot, OperationalSnapshot, PriorityQueueItem } from "@/types/operationsCenter";

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
    workersAvailable: 8,
    workersUnavailable: 2,
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

function makeKpis(overrides: Partial<OperationalKpiSnapshot> = {}): OperationalKpiSnapshot {
  return {
    activeOperations: 2,
    pausedOperations: 0,
    blockedOperations: 0,
    pendingAcceptances: 1,
    declineRate: 10,
    dispatchQueueHealth: 90,
    routeHealth: 100,
    highRiskRoutes: 0,
    schedulingConflicts: 0,
    capacityUsage: 40,
    availableWorkers: 8,
    unavailableWorkers: 2,
    equipmentInUse: 0,
    vehiclesInUse: 0,
    criticalAlerts: 0,
    openIncidents: 0,
    averageExecutionHealth: 90,
    overallOperationalStatus: "normal",
    ...overrides,
  };
}

function makeIncident(overrides: Partial<OperationalIncident> = {}): OperationalIncident {
  return { id: "operational_incident_1", workspace_id: "ws_1", title: "Incident", description: "", severity: "critical", status: "open", source_alert_ids: [], related_dispatch_order_ids: [], related_field_operation_ids: [], related_route_plan_ids: [], related_worker_ids: [], related_vehicle_ids: [], related_equipment_ids: [], owner_member_id: null, resolution_notes: null, created_at: "2026-01-01T00:00:00.000Z", acknowledged_at: null, resolved_at: null, updated_at: "2026-01-01T00:00:00.000Z", ...overrides };
}

function makePriorityItem(overrides: Partial<PriorityQueueItem> = {}): PriorityQueueItem {
  return { id: "item_1", type: "alert", severity: "critical", title: "Item", description: "Item description", sourceRef: null, deepLink: null, ...overrides };
}

function baseData(overrides: Partial<BriefSourceData> = {}): BriefSourceData {
  return { snapshot: makeSnapshot(), status: "normal", kpis: makeKpis(), priorityQueue: [], openIncidents: [], previousKpis: null, ...overrides };
}

describe("computeOperationsBrief", () => {
  it("summarizes status, active operations, pending acceptances, alerts, and incidents in one sentence", () => {
    const brief = computeOperationsBrief(baseData({ status: "at_risk", kpis: makeKpis({ activeOperations: 3, pendingAcceptances: 2, criticalAlerts: 1, openIncidents: 1 }) }), "2026-01-01T00:00:00.000Z");
    expect(brief.currentOperationalSummary).toBe("Status: at_risk. 3 active operations, 2 pending acceptances, 1 critical alert, 1 open incident.");
  });

  it("derives criticalIssues, blockedWork, and highRiskRoutes from the priority queue's own already-typed items", () => {
    const queue = [makePriorityItem({ id: "a1", type: "alert", severity: "critical", title: "Critical alert" }), makePriorityItem({ id: "op1", type: "operation", severity: "critical", description: "Field operation fo1 is blocked." }), makePriorityItem({ id: "r1", type: "route", severity: "high", description: "Route rp1 is at high delay risk." })];
    const brief = computeOperationsBrief(baseData({ priorityQueue: queue }), "2026-01-01T00:00:00.000Z");
    expect(brief.criticalIssues).toContain("Critical alert");
    expect(brief.blockedWork).toEqual(["Field operation fo1 is blocked."]);
    expect(brief.highRiskRoutes).toEqual(["Route rp1 is at high delay risk."]);
  });

  it("flags capacity risks only when a real threshold is crossed", () => {
    const noRisk = computeOperationsBrief(baseData(), "2026-01-01T00:00:00.000Z");
    expect(noRisk.capacityRisks).toEqual([]);

    const withRisk = computeOperationsBrief(baseData({ kpis: makeKpis({ schedulingConflicts: 2, capacityUsage: 95 }), snapshot: makeSnapshot({ workersAvailable: 1, workersUnavailable: 9 }) }), "2026-01-01T00:00:00.000Z");
    expect(withRisk.capacityRisks).toHaveLength(3);
  });

  it("caps topPriorities at 5 items, taking them in the priority queue's own already-sorted order", () => {
    const queue = Array.from({ length: 8 }, (_, i) => makePriorityItem({ id: `i${i}`, title: `Item ${i}` }));
    const brief = computeOperationsBrief(baseData({ priorityQueue: queue }), "2026-01-01T00:00:00.000Z");
    expect(brief.topPriorities).toHaveLength(5);
    expect(brief.topPriorities[0]).toBe("Item 0");
  });

  it("reports openIncidentsCount from the real open incident list length", () => {
    const brief = computeOperationsBrief(baseData({ openIncidents: [makeIncident({ id: "i1" }), makeIncident({ id: "i2" })] }), "2026-01-01T00:00:00.000Z");
    expect(brief.openIncidentsCount).toBe(2);
  });

  it("produces no improvements/regressions when there is no previous KPI snapshot to diff against", () => {
    const brief = computeOperationsBrief(baseData({ previousKpis: null }), "2026-01-01T00:00:00.000Z");
    expect(brief.recentImprovements).toEqual([]);
    expect(brief.recentRegressions).toEqual([]);
  });

  it("diffs against a previous KPI snapshot to produce real improvement/regression sentences", () => {
    const brief = computeOperationsBrief(baseData({ kpis: makeKpis({ criticalAlerts: 0, declineRate: 20 }), previousKpis: makeKpis({ criticalAlerts: 3, declineRate: 10 }) }), "2026-01-01T00:00:00.000Z");
    expect(brief.recentImprovements.some((s) => s.includes("Critical alerts improved from 3 to 0"))).toBe(true);
    expect(brief.recentRegressions.some((s) => s.includes("Decline rate went from 10 to 20"))).toBe(true);
  });
});
