import { describe, expect, it } from "vitest";
import { routeFindingsToRecommendations } from "@/core/routeOptimization/routeFindingsEngine";
import type { RouteFinding, RoutePlan } from "@/types/routeOptimization";

function buildRoutePlan(overrides: Partial<RoutePlan> = {}): RoutePlan {
  return {
    id: "route_plan_1",
    workspace_id: "ws_1",
    dispatch_order_id: "dispatch_order_1",
    dispatch_assignment_id: "assignment_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    operational_plan_id: "plan_1",
    priority: "medium",
    context: { nodeType: "event", nodeId: "event_1" },
    status: "draft",
    versions: [],
    created_by: "member_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

function buildFinding(overrides: Partial<RouteFinding> = {}): RouteFinding {
  return { id: "finding_1", type: "high_delay_risk", severity: "high", description: "Delayed.", relatedRoutePlanId: "route_plan_1", ...overrides };
}

describe("routeFindingsEngine", () => {
  it("maps severity high/medium/low to critical/warning/info", () => {
    const findings: RouteFinding[] = [buildFinding({ id: "f1", severity: "high" }), buildFinding({ id: "f2", severity: "medium" }), buildFinding({ id: "f3", severity: "low" })];
    const recommendations = routeFindingsToRecommendations(findings, [buildRoutePlan()], "ws_1");
    expect(recommendations.map((r) => r.severity)).toEqual(["critical", "warning", "info"]);
  });

  it("prefixes ruleId with route_optimization.", () => {
    const recommendations = routeFindingsToRecommendations([buildFinding({ type: "low_route_efficiency" })], [buildRoutePlan()], "ws_1");
    expect(recommendations[0].ruleId).toBe("route_optimization.low_route_efficiency");
  });

  it("resolves the related route plan's own context node when set", () => {
    const recommendations = routeFindingsToRecommendations([buildFinding()], [buildRoutePlan({ context: { nodeType: "event", nodeId: "event_specific" } })], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "event", nodeId: "event_specific" });
  });

  it("falls back to the workspace node when the route plan has no context", () => {
    const recommendations = routeFindingsToRecommendations([buildFinding()], [buildRoutePlan({ context: null })], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("falls back to the workspace node when no related route plan is found", () => {
    const recommendations = routeFindingsToRecommendations([buildFinding({ relatedRoutePlanId: "missing" })], [buildRoutePlan()], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });

  it("falls back to the workspace node when relatedRoutePlanId is null", () => {
    const recommendations = routeFindingsToRecommendations([buildFinding({ relatedRoutePlanId: null })], [buildRoutePlan()], "ws_1");
    expect(recommendations[0].node).toEqual({ nodeType: "workspace", nodeId: "ws_1" });
  });
});
