import { describe, expect, it } from "vitest";
import { explainRoute } from "@/core/routeOptimization/routeExplanationEngine";
import type { RouteValidationResult, RouteHealthScores, TravelEstimate, OptimizationResult, TravelConstraint } from "@/types/routeOptimization";

function makeEstimate(overrides: Partial<TravelEstimate> = {}): TravelEstimate {
  return { estimatedTravelMinutes: 30, estimatedDistanceKm: 10, estimatedDepartureAt: null, estimatedArrivalAt: null, estimatedIdleMinutes: 0, estimatedTotalDurationMinutes: 60, ...overrides };
}

function makeHealth(overrides: Partial<RouteHealthScores> = {}): RouteHealthScores {
  return { travelHealth: 100, efficiencyHealth: 100, delayRisk: 0, constraintHealth: 100, optimizationHealth: 100, overallRouteHealth: 100, ...overrides };
}

const VALID: RouteValidationResult = { valid: true, errors: [], warnings: [] };
const OPTIMIZATION: OptimizationResult = { optimizedWaypointOrder: ["wp_a", "wp_b"], totalTravelMinutes: 30, totalIdleMinutes: 0, travelEfficiency: 80, resourceUtilization: 90, optimizationScore: 85, improved: true };

describe("routeExplanationEngine", () => {
  it("summarizes a valid route around its own health", () => {
    const result = explainRoute(VALID, makeHealth(), makeEstimate(), null, [], 0);
    expect(result.summary).toContain("valid");
    expect(result.rejectedRouteReasons).toHaveLength(0);
  });

  it("surfaces validation errors as rejected-route reasons for an invalid route", () => {
    const invalid: RouteValidationResult = { valid: false, errors: [{ rule: "worker_not_assigned", detail: "No worker is assigned to this route." }], warnings: [] };
    const result = explainRoute(invalid, makeHealth(), makeEstimate(), null, [], 0);
    expect(result.summary).toContain("invalid");
    expect(result.rejectedRouteReasons).toEqual(["No worker is assigned to this route."]);
  });

  it("reports no optimization has run yet when optimization is null", () => {
    const result = explainRoute(VALID, makeHealth(), makeEstimate(), null, [], 0);
    expect(result.optimizationDecisions).toEqual(["No optimization has been run yet."]);
    expect(result.optimizationScoreSummary).toBe("Not yet optimized.");
  });

  it("describes the optimized stop order and whether it improved travel", () => {
    const result = explainRoute(VALID, makeHealth(), makeEstimate(), OPTIMIZATION, [], 2);
    expect(result.optimizationDecisions[0]).toContain("wp_a -> wp_b");
    expect(result.optimizationDecisions[1]).toContain("reduces total declared travel time");
    expect(result.optimizationScoreSummary).toContain("85/100");
  });

  it("lists every currently-violated constraint by its own description", () => {
    const constraint: TravelConstraint = { id: "c1", route_plan_id: "route_plan_1", kind: "max_travel_minutes", limit_value: 10, description: "Travel must stay under 10 minutes." };
    const result = explainRoute(VALID, makeHealth(), makeEstimate({ estimatedTravelMinutes: 30 }), null, [constraint], 0);
    expect(result.constraintViolations).toEqual(["Travel must stay under 10 minutes."]);
  });

  it("includes the travel estimate and health summaries", () => {
    const result = explainRoute(VALID, makeHealth({ overallRouteHealth: 90 }), makeEstimate({ estimatedTravelMinutes: 45, estimatedDistanceKm: 12 }), null, [], 0);
    expect(result.travelEstimateSummary).toContain("45m");
    expect(result.travelEstimateSummary).toContain("12km");
    expect(result.healthSummary).toBe("Overall route health 90/100.");
  });
});
