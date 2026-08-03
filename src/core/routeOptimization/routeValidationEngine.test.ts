import { describe, expect, it } from "vitest";
import { validateRoute } from "@/core/routeOptimization/routeValidationEngine";
import type { RouteValidationInput, Waypoint, RouteSegment } from "@/types/routeOptimization";

const ORIGIN: Waypoint = { id: "wp_origin", route_plan_id: "route_plan_1", sequence_index: 0, kind: "origin", label: "Origin", phase_id: null };
const STOP: Waypoint = { id: "wp_stop", route_plan_id: "route_plan_1", sequence_index: 1, kind: "phase_stop", label: "Phase 1", phase_id: "phase_1" };
const DESTINATION: Waypoint = { id: "wp_dest", route_plan_id: "route_plan_1", sequence_index: 2, kind: "destination", label: "Destination", phase_id: null };

const SEGMENT_1: RouteSegment = { id: "seg_1", route_plan_id: "route_plan_1", sequence_index: 0, from_waypoint_id: "wp_origin", to_waypoint_id: "wp_stop", travel_leg_id: "leg_1", work_duration_minutes: 30 };
const SEGMENT_2: RouteSegment = { id: "seg_2", route_plan_id: "route_plan_1", sequence_index: 1, from_waypoint_id: "wp_stop", to_waypoint_id: "wp_dest", travel_leg_id: "leg_2", work_duration_minutes: 0 };

function baseInput(overrides: Partial<RouteValidationInput> = {}): RouteValidationInput {
  return {
    assignmentExists: true,
    workerAssigned: true,
    vehicleAssignedPlaceholder: true,
    executionPackageApproved: true,
    dispatchActive: true,
    waypoints: [ORIGIN, STOP, DESTINATION],
    segments: [SEGMENT_1, SEGMENT_2],
    ...overrides,
  };
}

describe("routeValidationEngine", () => {
  it("is valid when every fact holds and the route is a clean linear path", () => {
    const result = validateRoute(baseInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects when the assignment doesn't exist", () => {
    const result = validateRoute(baseInput({ assignmentExists: false }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.rule)).toContain("assignment_missing");
  });

  it("rejects when no worker is assigned", () => {
    const result = validateRoute(baseInput({ workerAssigned: false }));
    expect(result.errors.map((e) => e.rule)).toContain("worker_not_assigned");
  });

  it("rejects when the vehicle placeholder check fails", () => {
    const result = validateRoute(baseInput({ vehicleAssignedPlaceholder: false }));
    expect(result.errors.map((e) => e.rule)).toContain("vehicle_placeholder_failed");
  });

  it("rejects when the execution package isn't approved", () => {
    const result = validateRoute(baseInput({ executionPackageApproved: false }));
    expect(result.errors.map((e) => e.rule)).toContain("package_not_approved");
  });

  it("rejects when the dispatch is no longer active", () => {
    const result = validateRoute(baseInput({ dispatchActive: false }));
    expect(result.errors.map((e) => e.rule)).toContain("dispatch_inactive");
  });

  it("rejects a route with a duplicate waypoint id", () => {
    const result = validateRoute(baseInput({ waypoints: [ORIGIN, STOP, { ...STOP }, DESTINATION] }));
    expect(result.errors.map((e) => e.rule)).toContain("duplicate_stops_detected");
  });

  it("rejects a route with two stops referencing the same phase", () => {
    const duplicatePhaseStop: Waypoint = { id: "wp_stop_2", route_plan_id: "route_plan_1", sequence_index: 2, kind: "phase_stop", label: "Phase 1 again", phase_id: "phase_1" };
    const result = validateRoute(baseInput({ waypoints: [ORIGIN, STOP, duplicatePhaseStop, DESTINATION] }));
    expect(result.errors.map((e) => e.rule)).toContain("duplicate_stops_detected");
  });

  it("rejects a route that loops back to an already-visited waypoint", () => {
    const circularSegments: RouteSegment[] = [SEGMENT_1, SEGMENT_2, { id: "seg_3", route_plan_id: "route_plan_1", sequence_index: 2, from_waypoint_id: "wp_dest", to_waypoint_id: "wp_origin", travel_leg_id: "leg_3", work_duration_minutes: 0 }];
    const result = validateRoute(baseInput({ segments: circularSegments }));
    expect(result.errors.map((e) => e.rule)).toContain("circular_route_detected");
  });

  it("collects every failing check at once, not just the first", () => {
    const result = validateRoute(baseInput({ assignmentExists: false, workerAssigned: false, dispatchActive: false }));
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
