import { describe, expect, it } from "vitest";
import { computeTravelEstimate } from "@/core/routeOptimization/travelEngine";
import type { TravelLeg, RouteSegment } from "@/types/routeOptimization";

function makeLeg(overrides: Partial<TravelLeg> = {}): TravelLeg {
  return { id: "leg_1", route_plan_id: "route_plan_1", from_waypoint_id: "wp_1", to_waypoint_id: "wp_2", declared_distance_km: 10, declared_travel_minutes: 20, ...overrides };
}

function makeSegment(overrides: Partial<RouteSegment> = {}): RouteSegment {
  return { id: "segment_1", route_plan_id: "route_plan_1", sequence_index: 0, from_waypoint_id: "wp_1", to_waypoint_id: "wp_2", travel_leg_id: "leg_1", work_duration_minutes: 30, ...overrides };
}

describe("travelEngine", () => {
  it("sums declared travel minutes and distance across every leg", () => {
    const legs = [makeLeg({ declared_travel_minutes: 20, declared_distance_km: 10 }), makeLeg({ id: "leg_2", declared_travel_minutes: 15, declared_distance_km: 5 })];
    const result = computeTravelEstimate({ travelLegs: legs, segments: [], departureAt: null });
    expect(result.estimatedTravelMinutes).toBe(35);
    expect(result.estimatedDistanceKm).toBe(15);
  });

  it("sums work duration across every segment into the total duration, alongside travel", () => {
    const result = computeTravelEstimate({ travelLegs: [makeLeg({ declared_travel_minutes: 20 })], segments: [makeSegment({ work_duration_minutes: 30 }), makeSegment({ id: "segment_2", work_duration_minutes: 45 })], departureAt: null });
    expect(result.estimatedTotalDurationMinutes).toBe(95);
  });

  it("idle time is always 0 this checkpoint — a disclosed placeholder, not fabricated data", () => {
    const result = computeTravelEstimate({ travelLegs: [makeLeg()], segments: [makeSegment()], departureAt: null });
    expect(result.estimatedIdleMinutes).toBe(0);
  });

  it("leaves departure/arrival null when no start time is declared", () => {
    const result = computeTravelEstimate({ travelLegs: [makeLeg()], segments: [makeSegment()], departureAt: null });
    expect(result.estimatedDepartureAt).toBeNull();
    expect(result.estimatedArrivalAt).toBeNull();
  });

  it("computes arrival as departure plus the total duration when a start time is declared", () => {
    const result = computeTravelEstimate({ travelLegs: [makeLeg({ declared_travel_minutes: 20 })], segments: [makeSegment({ work_duration_minutes: 40 })], departureAt: "2026-01-01T08:00:00.000Z" });
    expect(result.estimatedDepartureAt).toBe("2026-01-01T08:00:00.000Z");
    expect(result.estimatedArrivalAt).toBe("2026-01-01T09:00:00.000Z");
  });

  it("handles an empty route (no legs, no segments) as all zeros", () => {
    const result = computeTravelEstimate({ travelLegs: [], segments: [], departureAt: null });
    expect(result.estimatedTravelMinutes).toBe(0);
    expect(result.estimatedDistanceKm).toBe(0);
    expect(result.estimatedTotalDurationMinutes).toBe(0);
  });
});
