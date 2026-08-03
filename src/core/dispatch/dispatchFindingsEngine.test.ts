import { describe, expect, it } from "vitest";
import { dispatchFindingsToRecommendations } from "@/core/dispatch/dispatchFindingsEngine";
import type { DispatchFinding, DispatchOrder } from "@/types/dispatch";

function buildOrder(overrides: Partial<DispatchOrder> = {}): DispatchOrder {
  return {
    id: "order_1",
    workspace_id: "ws_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    batch_id: null,
    status: "dispatched",
    priority: "medium",
    source: "execution_package_derived",
    assignments: [],
    created_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    cancelled_at: null,
    archived_at: null,
    ...overrides,
  };
}

function buildFinding(overrides: Partial<DispatchFinding> = {}): DispatchFinding {
  return { id: "finding_1", type: "dispatch_blocked", severity: "high", description: "Blocked.", relatedOrderId: "order_1", ...overrides };
}

describe("dispatchFindingsEngine", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings: DispatchFinding[] = [
      buildFinding({ id: "f1", severity: "high" }),
      buildFinding({ id: "f2", severity: "medium" }),
      buildFinding({ id: "f3", severity: "low" }),
    ];
    const recommendations = dispatchFindingsToRecommendations(findings, [buildOrder()], "ws_1");
    expect(recommendations.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("prefixes ruleId with dispatch.", () => {
    const recommendations = dispatchFindingsToRecommendations([buildFinding({ type: "queue_congestion" })], [buildOrder()], "ws_1");
    expect(recommendations[0].ruleId).toBe("dispatch.queue_congestion");
  });

  it("resolves the related order's workspace as the node when the order is found", () => {
    const recommendations = dispatchFindingsToRecommendations([buildFinding()], [buildOrder({ workspace_id: "ws_specific" })], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_specific" });
  });

  it("falls back to the passed-in workspaceId when no related order is found", () => {
    const recommendations = dispatchFindingsToRecommendations([buildFinding({ relatedOrderId: "missing_order" })], [buildOrder()], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("falls back to workspaceId when relatedOrderId is null", () => {
    const recommendations = dispatchFindingsToRecommendations([buildFinding({ relatedOrderId: null })], [buildOrder()], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });
});
