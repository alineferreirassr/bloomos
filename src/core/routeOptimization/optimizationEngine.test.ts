import { describe, expect, it } from "vitest";
import { optimizeRoute } from "@/core/routeOptimization/optimizationEngine";
import type { Waypoint, RouteSegment, TravelLeg } from "@/types/routeOptimization";

const ORIGIN: Waypoint = { id: "wp_origin", route_plan_id: "route_plan_1", sequence_index: 0, kind: "origin", label: "Origin", phase_id: null };
const STOP_A: Waypoint = { id: "wp_a", route_plan_id: "route_plan_1", sequence_index: 1, kind: "phase_stop", label: "Stop A", phase_id: "phase_a" };
const STOP_B: Waypoint = { id: "wp_b", route_plan_id: "route_plan_1", sequence_index: 2, kind: "phase_stop", label: "Stop B", phase_id: "phase_b" };
const DESTINATION: Waypoint = { id: "wp_dest", route_plan_id: "route_plan_1", sequence_index: 3, kind: "destination", label: "Destination", phase_id: null };

function baseWaypoints(): Waypoint[] {
  return [ORIGIN, STOP_A, STOP_B, DESTINATION];
}

function zeroLegs(): TravelLeg[] {
  return [
    { id: "leg_o_a", route_plan_id: "route_plan_1", from_waypoint_id: "wp_origin", to_waypoint_id: "wp_a", declared_distance_km: 0, declared_travel_minutes: 0 },
    { id: "leg_a_b", route_plan_id: "route_plan_1", from_waypoint_id: "wp_a", to_waypoint_id: "wp_b", declared_distance_km: 0, declared_travel_minutes: 0 },
    { id: "leg_b_d", route_plan_id: "route_plan_1", from_waypoint_id: "wp_b", to_waypoint_id: "wp_dest", declared_distance_km: 0, declared_travel_minutes: 0 },
  ];
}

function baseSegments(workByTo: Record<string, number> = {}): RouteSegment[] {
  return [
    { id: "seg_1", route_plan_id: "route_plan_1", sequence_index: 0, from_waypoint_id: "wp_origin", to_waypoint_id: "wp_a", travel_leg_id: "leg_o_a", work_duration_minutes: workByTo["wp_a"] ?? 30 },
    { id: "seg_2", route_plan_id: "route_plan_1", sequence_index: 1, from_waypoint_id: "wp_a", to_waypoint_id: "wp_b", travel_leg_id: "leg_a_b", work_duration_minutes: workByTo["wp_b"] ?? 30 },
    { id: "seg_3", route_plan_id: "route_plan_1", sequence_index: 2, from_waypoint_id: "wp_b", to_waypoint_id: "wp_dest", travel_leg_id: "leg_b_d", work_duration_minutes: workByTo["wp_dest"] ?? 0 },
  ];
}

describe("optimizationEngine", () => {
  it("with every leg still at its 0 default, preserves the original order and reports improved: false", () => {
    const result = optimizeRoute({ routePlanId: "route_plan_1", waypoints: baseWaypoints(), travelLegs: zeroLegs(), segments: baseSegments() });
    expect(result.optimization.optimizedWaypointOrder).toEqual(["wp_a", "wp_b"]);
    expect(result.optimization.improved).toBe(false);
    expect(result.optimization.totalTravelMinutes).toBe(0);
  });

  it("reorders stops ascending by their own declared cost-to-reach when real figures are declared", () => {
    const legs: TravelLeg[] = [
      { id: "leg_o_a", route_plan_id: "route_plan_1", from_waypoint_id: "wp_origin", to_waypoint_id: "wp_a", declared_distance_km: 20, declared_travel_minutes: 40 },
      { id: "leg_a_b", route_plan_id: "route_plan_1", from_waypoint_id: "wp_a", to_waypoint_id: "wp_b", declared_distance_km: 5, declared_travel_minutes: 10 },
      { id: "leg_b_d", route_plan_id: "route_plan_1", from_waypoint_id: "wp_b", to_waypoint_id: "wp_dest", declared_distance_km: 5, declared_travel_minutes: 10 },
    ];
    const result = optimizeRoute({ routePlanId: "route_plan_1", waypoints: baseWaypoints(), travelLegs: legs, segments: baseSegments() });
    // Stop B's declared cost-to-reach (10) is cheaper than Stop A's (40), so B sorts first.
    expect(result.optimization.optimizedWaypointOrder).toEqual(["wp_b", "wp_a"]);
  });

  it("creates a fresh 0-declared placeholder leg for any newly-adjacent pair that never had one", () => {
    const legs: TravelLeg[] = [
      { id: "leg_o_a", route_plan_id: "route_plan_1", from_waypoint_id: "wp_origin", to_waypoint_id: "wp_a", declared_distance_km: 20, declared_travel_minutes: 40 },
      { id: "leg_a_b", route_plan_id: "route_plan_1", from_waypoint_id: "wp_a", to_waypoint_id: "wp_b", declared_distance_km: 5, declared_travel_minutes: 10 },
      { id: "leg_b_d", route_plan_id: "route_plan_1", from_waypoint_id: "wp_b", to_waypoint_id: "wp_dest", declared_distance_km: 5, declared_travel_minutes: 10 },
    ];
    const result = optimizeRoute({ routePlanId: "route_plan_1", waypoints: baseWaypoints(), travelLegs: legs, segments: baseSegments() });
    // The new order is origin -> B -> A -> destination; "origin -> B" never had a declared leg before.
    const originToB = result.travelLegs.find((l) => l.from_waypoint_id === "wp_origin" && l.to_waypoint_id === "wp_b");
    expect(originToB?.declared_travel_minutes).toBe(0);
  });

  it("computes travel efficiency as the work share of total time, vacuous 100 when nothing is tracked", () => {
    const result = optimizeRoute({ routePlanId: "route_plan_1", waypoints: [ORIGIN, DESTINATION], travelLegs: [], segments: [] });
    expect(result.optimization.travelEfficiency).toBe(100);
    expect(result.optimization.resourceUtilization).toBe(100);
  });

  it("computes resourceUtilization as the share of stops that actually have work", () => {
    const result = optimizeRoute({ routePlanId: "route_plan_1", waypoints: baseWaypoints(), travelLegs: zeroLegs(), segments: baseSegments({ wp_a: 0, wp_b: 30, wp_dest: 0 }) });
    expect(result.optimization.resourceUtilization).toBe(50);
  });

  it("marks improved: true only when the optimized order's total travel is strictly less than the original", () => {
    const legs: TravelLeg[] = [
      { id: "leg_o_a", route_plan_id: "route_plan_1", from_waypoint_id: "wp_origin", to_waypoint_id: "wp_a", declared_distance_km: 20, declared_travel_minutes: 40 },
      { id: "leg_a_b", route_plan_id: "route_plan_1", from_waypoint_id: "wp_a", to_waypoint_id: "wp_b", declared_distance_km: 5, declared_travel_minutes: 10 },
      { id: "leg_b_d", route_plan_id: "route_plan_1", from_waypoint_id: "wp_b", to_waypoint_id: "wp_dest", declared_distance_km: 5, declared_travel_minutes: 10 },
    ];
    const result = optimizeRoute({ routePlanId: "route_plan_1", waypoints: baseWaypoints(), travelLegs: legs, segments: baseSegments() });
    // original total = 40+10+10 = 60; optimized path (origin->B[new,0]->A[old,10->B? no: A->dest]) recomputed below.
    expect(result.optimization.totalTravelMinutes).toBeLessThan(60);
    expect(result.optimization.improved).toBe(true);
  });

  it("is a pure, deterministic function — identical input always produces identical output", () => {
    const input = { routePlanId: "route_plan_1", waypoints: baseWaypoints(), travelLegs: zeroLegs(), segments: baseSegments() };
    const first = optimizeRoute(input);
    const second = optimizeRoute(input);
    expect(first.optimization).toEqual(second.optimization);
  });
});
