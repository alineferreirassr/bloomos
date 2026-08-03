import { describe, expect, it } from "vitest";
import { computeOperationalStatus } from "@/core/operationsCenter/operationalStatusEngine";
import type { LiveOperationSummary, OperationalSnapshot } from "@/types/operationsCenter";

function makeLiveOperations(overrides: Partial<LiveOperationSummary> = {}): LiveOperationSummary {
  return { activeDispatchOrders: 0, pendingAssignments: 0, acceptedAssignments: 0, declinedAssignments: 0, expiredAssignments: 0, activeFieldOperations: 0, pausedFieldOperations: 0, blockedFieldOperations: 0, completedFieldOperations: 0, activeRoutes: 0, highRiskRoutes: 0, ...overrides };
}

function makeSnapshot(overrides: Partial<OperationalSnapshot> = {}): OperationalSnapshot {
  return {
    workspaceId: "ws_1",
    generatedAt: "2026-01-01T00:00:00.000Z",
    confidence: 100,
    sourceOutcomes: [{ source: "dispatch", state: "successful", data: {}, error: null, fetchedAt: "now" }],
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

describe("computeOperationalStatus", () => {
  it("is unknown when nothing has ever been fetched", () => {
    expect(computeOperationalStatus(makeSnapshot({ sourceOutcomes: [] }))).toBe("unknown");
  });

  it("is degraded when too much of the aggregation is stale/missing to trust a judgment, even if the operation itself looks fine", () => {
    expect(computeOperationalStatus(makeSnapshot({ confidence: 30 }))).toBe("degraded");
  });

  it("is normal when every source is healthy and no facts require attention", () => {
    expect(computeOperationalStatus(makeSnapshot())).toBe("normal");
  });

  it("is attention when a mild, non-blocking fact is present", () => {
    expect(computeOperationalStatus(makeSnapshot({ capacityAlerts: 1 }))).toBe("attention");
    expect(computeOperationalStatus(makeSnapshot({ liveOperations: makeLiveOperations({ pausedFieldOperations: 1 }) }))).toBe("attention");
  });

  it("is at_risk when a more serious fact is present", () => {
    expect(computeOperationalStatus(makeSnapshot({ liveOperations: makeLiveOperations({ highRiskRoutes: 1 }) }))).toBe("at_risk");
    expect(computeOperationalStatus(makeSnapshot({ allocationRisks: 2 }))).toBe("at_risk");
  });

  it("is critical when a blocking fact is present, outranking at_risk/attention facts also present", () => {
    const snapshot = makeSnapshot({ criticalExecutiveDecisions: 1, allocationRisks: 3, capacityAlerts: 2 });
    expect(computeOperationalStatus(snapshot)).toBe("critical");
  });

  it("is critical when business or knowledge health has collapsed, even with no other findings", () => {
    expect(computeOperationalStatus(makeSnapshot({ businessHealthScore: 20 }))).toBe("critical");
    expect(computeOperationalStatus(makeSnapshot({ knowledgeHealthScore: 10 }))).toBe("critical");
  });

  it("degraded confidence outranks the operation's own facts", () => {
    expect(computeOperationalStatus(makeSnapshot({ confidence: 10, criticalExecutiveDecisions: 5 }))).toBe("degraded");
  });
});
