import { describe, expect, it } from "vitest";
import { buildOperationalDigest } from "@/core/operationsCenter/communicationIntegrationEngine";
import type { OperationalKpiSnapshot } from "@/types/operationsCenter";

function makeKpis(overrides: Partial<OperationalKpiSnapshot> = {}): OperationalKpiSnapshot {
  return {
    activeOperations: 2,
    pausedOperations: 0,
    blockedOperations: 0,
    pendingAcceptances: 1,
    declineRate: 0,
    dispatchQueueHealth: 100,
    routeHealth: 100,
    highRiskRoutes: 0,
    schedulingConflicts: 0,
    capacityUsage: 0,
    availableWorkers: 8,
    unavailableWorkers: 2,
    equipmentInUse: 0,
    vehiclesInUse: 0,
    criticalAlerts: 0,
    openIncidents: 0,
    averageExecutionHealth: 100,
    overallOperationalStatus: "normal",
    ...overrides,
  };
}

describe("buildOperationalDigest", () => {
  it("always reports operations counts, pending acceptances, and worker availability", () => {
    const digest = buildOperationalDigest("normal", makeKpis());
    expect(digest).toContain("Operations status: normal.");
    expect(digest).toContain("2 active operations");
    expect(digest).toContain("1 assignment awaiting acceptance.");
    expect(digest).toContain("8 of 10 workers available.");
  });

  it("omits critical-issue lines entirely when there is nothing to report", () => {
    const digest = buildOperationalDigest("normal", makeKpis());
    expect(digest).not.toContain("critical alert");
    expect(digest).not.toContain("incident");
    expect(digest).not.toContain("delay risk");
    expect(digest).not.toContain("scheduling conflict");
  });

  it("surfaces critical alerts, incidents, high-risk routes, and scheduling conflicts only when present", () => {
    const digest = buildOperationalDigest("critical", makeKpis({ criticalAlerts: 2, openIncidents: 1, highRiskRoutes: 3, schedulingConflicts: 1 }));
    expect(digest).toContain("2 critical alerts open.");
    expect(digest).toContain("1 open incident.");
    expect(digest).toContain("3 routes at high delay risk.");
    expect(digest).toContain("1 scheduling conflict.");
  });
});
