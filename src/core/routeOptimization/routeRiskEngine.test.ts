import { describe, expect, it } from "vitest";
import { detectRouteRisks } from "@/core/routeOptimization/routeRiskEngine";
import type { RouteValidationResult, RouteHealthScores, OptimizationResult } from "@/types/routeOptimization";

function makeValidation(overrides: Partial<RouteValidationResult> = {}): RouteValidationResult {
  return { valid: true, errors: [], warnings: [], ...overrides };
}

function makeHealth(overrides: Partial<RouteHealthScores> = {}): RouteHealthScores {
  return { travelHealth: 100, efficiencyHealth: 100, delayRisk: 0, constraintHealth: 100, optimizationHealth: 100, overallRouteHealth: 100, ...overrides };
}

const OPTIMIZATION: OptimizationResult = { optimizedWaypointOrder: ["wp_a"], totalTravelMinutes: 30, totalIdleMinutes: 0, travelEfficiency: 80, resourceUtilization: 90, optimizationScore: 85, improved: true };

describe("routeRiskEngine", () => {
  it("detects low_route_efficiency when optimized travel efficiency is below threshold", () => {
    const lowEfficiency: OptimizationResult = { ...OPTIMIZATION, travelEfficiency: 40 };
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation(), health: makeHealth(), optimization: lowEfficiency }]);
    expect(findings.map((f) => f.type)).toContain("low_route_efficiency");
  });

  it("detects high_delay_risk when the health score's delayRisk exceeds threshold", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation(), health: makeHealth({ delayRisk: 90 }), optimization: null }]);
    const finding = findings.find((f) => f.type === "high_delay_risk");
    expect(finding?.severity).toBe("high");
  });

  it("detects travel_constraint when constraintHealth is below 100", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation(), health: makeHealth({ constraintHealth: 50 }), optimization: null }]);
    expect(findings.map((f) => f.type)).toContain("travel_constraint");
  });

  it("detects optimization_opportunity when the route has never been optimized", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation(), health: makeHealth(), optimization: null }]);
    expect(findings.map((f) => f.type)).toContain("optimization_opportunity");
  });

  it("does not detect optimization_opportunity once an optimization result exists", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation(), health: makeHealth(), optimization: OPTIMIZATION }]);
    expect(findings.map((f) => f.type)).not.toContain("optimization_opportunity");
  });

  it("detects healthy_route when valid and overallRouteHealth is at least 80", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation({ valid: true }), health: makeHealth({ overallRouteHealth: 85 }), optimization: OPTIMIZATION }]);
    expect(findings.map((f) => f.type)).toContain("healthy_route");
  });

  it("does not detect healthy_route when the route is invalid, even with high overallRouteHealth", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_1", validation: makeValidation({ valid: false }), health: makeHealth({ overallRouteHealth: 90 }), optimization: OPTIMIZATION }]);
    expect(findings.map((f) => f.type)).not.toContain("healthy_route");
  });

  it("every finding carries the route plan id it relates to", () => {
    const findings = detectRouteRisks([{ routePlanId: "plan_42", validation: makeValidation(), health: makeHealth(), optimization: null }]);
    for (const finding of findings) expect(finding.relatedRoutePlanId).toBe("plan_42");
  });
});
