import { describe, expect, it } from "vitest";
import { computeTravelHealth, computeEfficiencyHealth, computeDelayRisk, computeConstraintHealth, computeOptimizationHealth, computeRouteHealthScores } from "@/core/routeOptimization/routeHealthEngine";
import type { TravelEstimate, TravelConstraint, OptimizationResult } from "@/types/routeOptimization";

function makeEstimate(overrides: Partial<TravelEstimate> = {}): TravelEstimate {
  return { estimatedTravelMinutes: 30, estimatedDistanceKm: 10, estimatedDepartureAt: null, estimatedArrivalAt: null, estimatedIdleMinutes: 0, estimatedTotalDurationMinutes: 60, ...overrides };
}

const OPTIMIZATION: OptimizationResult = { optimizedWaypointOrder: ["wp_a"], totalTravelMinutes: 30, totalIdleMinutes: 0, travelEfficiency: 80, resourceUtilization: 90, optimizationScore: 85, improved: true };

describe("routeHealthEngine", () => {
  describe("computeTravelHealth", () => {
    it("is vacuous-100 when no max_travel_minutes constraint is declared", () => {
      expect(computeTravelHealth(makeEstimate({ estimatedTravelMinutes: 500 }), [])).toBe(100);
    });

    it("is 100 when travel is within the declared limit", () => {
      const constraint: TravelConstraint = { id: "c1", route_plan_id: "route_plan_1", kind: "max_travel_minutes", limit_value: 60, description: "" };
      expect(computeTravelHealth(makeEstimate({ estimatedTravelMinutes: 30 }), [constraint])).toBe(100);
    });

    it("degrades proportionally once travel exceeds the declared limit", () => {
      const constraint: TravelConstraint = { id: "c1", route_plan_id: "route_plan_1", kind: "max_travel_minutes", limit_value: 30, description: "" };
      expect(computeTravelHealth(makeEstimate({ estimatedTravelMinutes: 60 }), [constraint])).toBe(50);
    });
  });

  describe("computeEfficiencyHealth / computeOptimizationHealth", () => {
    it("are vacuous-100 before optimization has ever run", () => {
      expect(computeEfficiencyHealth(null)).toBe(100);
      expect(computeOptimizationHealth(null)).toBe(100);
    });

    it("read the optimization result's own scores directly once it exists", () => {
      expect(computeEfficiencyHealth(OPTIMIZATION)).toBe(80);
      expect(computeOptimizationHealth(OPTIMIZATION)).toBe(85);
    });
  });

  describe("computeDelayRisk", () => {
    it("is vacuous-0 (no risk) when no latest_arrival_at constraint is declared", () => {
      expect(computeDelayRisk(makeEstimate({ estimatedArrivalAt: "2026-01-01T10:00:00.000Z" }), [])).toBe(0);
    });

    it("is 0 when the estimated arrival is at or before the declared deadline", () => {
      const constraint: TravelConstraint = { id: "c1", route_plan_id: "route_plan_1", kind: "latest_arrival_at", limit_value: "2026-01-01T10:00:00.000Z", description: "" };
      expect(computeDelayRisk(makeEstimate({ estimatedArrivalAt: "2026-01-01T09:00:00.000Z" }), [constraint])).toBe(0);
    });

    it("scales 1 point of risk per minute the arrival runs past the deadline, capped at 100", () => {
      const constraint: TravelConstraint = { id: "c1", route_plan_id: "route_plan_1", kind: "latest_arrival_at", limit_value: "2026-01-01T10:00:00.000Z", description: "" };
      expect(computeDelayRisk(makeEstimate({ estimatedArrivalAt: "2026-01-01T10:20:00.000Z" }), [constraint])).toBe(20);
      expect(computeDelayRisk(makeEstimate({ estimatedArrivalAt: "2026-01-01T14:00:00.000Z" }), [constraint])).toBe(100);
    });
  });

  describe("computeConstraintHealth", () => {
    it("is vacuous-100 when no constraints are declared", () => {
      expect(computeConstraintHealth([], makeEstimate(), 2)).toBe(100);
    });

    it("is the share of declared constraints currently satisfied", () => {
      const constraints: TravelConstraint[] = [
        { id: "c1", route_plan_id: "route_plan_1", kind: "max_travel_minutes", limit_value: 100, description: "" },
        { id: "c2", route_plan_id: "route_plan_1", kind: "max_stops", limit_value: 1, description: "" },
      ];
      // max_travel satisfied (30<=100), max_stops violated (2 stops > limit 1)
      expect(computeConstraintHealth(constraints, makeEstimate({ estimatedTravelMinutes: 30 }), 2)).toBe(50);
    });
  });

  describe("computeRouteHealthScores", () => {
    it("inverts delayRisk before averaging into overallRouteHealth", () => {
      const constraint: TravelConstraint = { id: "c1", route_plan_id: "route_plan_1", kind: "latest_arrival_at", limit_value: "2026-01-01T10:00:00.000Z", description: "" };
      const result = computeRouteHealthScores({ travelEstimate: makeEstimate({ estimatedArrivalAt: "2026-01-01T10:20:00.000Z" }), constraints: [constraint], optimization: null, phaseStopCount: 1 });
      expect(result.delayRisk).toBe(20);
      // travelHealth=100, efficiencyHealth=100, (100-20)=80, constraintHealth=0 (violated), optimizationHealth=100 -> avg = (100+100+80+0+100)/5 = 76
      expect(result.overallRouteHealth).toBe(76);
    });

    it("is fully healthy (100) with nothing declared and no optimization run yet", () => {
      const result = computeRouteHealthScores({ travelEstimate: makeEstimate({ estimatedTravelMinutes: 0, estimatedIdleMinutes: 0 }), constraints: [], optimization: null, phaseStopCount: 0 });
      expect(result.overallRouteHealth).toBe(100);
    });
  });
});
