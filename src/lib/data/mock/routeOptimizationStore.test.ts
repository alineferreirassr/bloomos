import { beforeEach, describe, expect, it } from "vitest";
import { resetRouteOptimizationStore, mockRouteOptimizationRepository, type CreateRoutePlanInput } from "@/lib/data/mock/routeOptimizationStore";
import type { Waypoint, RouteSegment, TravelLeg, OptimizationResult } from "@/types/routeOptimization";

const ORIGIN: Waypoint = { id: "wp_origin", route_plan_id: "route_plan_x", sequence_index: 0, kind: "origin", label: "Origin", phase_id: null };
const STOP: Waypoint = { id: "wp_stop_1", route_plan_id: "route_plan_x", sequence_index: 1, kind: "phase_stop", label: "Phase 1", phase_id: "phase_1" };
const DESTINATION: Waypoint = { id: "wp_dest", route_plan_id: "route_plan_x", sequence_index: 2, kind: "destination", label: "Destination", phase_id: null };

const LEG: TravelLeg = { id: "leg_1", route_plan_id: "route_plan_x", from_waypoint_id: "wp_origin", to_waypoint_id: "wp_stop_1", declared_distance_km: 10, declared_travel_minutes: 20 };

const SEGMENT: RouteSegment = { id: "segment_1", route_plan_id: "route_plan_x", sequence_index: 0, from_waypoint_id: "wp_origin", to_waypoint_id: "wp_stop_1", travel_leg_id: "leg_1", work_duration_minutes: 60 };

function baseInput(overrides: Partial<CreateRoutePlanInput> = {}): CreateRoutePlanInput {
  return {
    id: "route_plan_x",
    dispatch_order_id: "dispatch_order_1",
    dispatch_assignment_id: "assignment_1",
    execution_package_id: "package_1",
    execution_version_id: "version_1",
    operational_plan_id: "plan_1",
    priority: "medium",
    context: { nodeType: "event", nodeId: "event_1" },
    waypoints: [ORIGIN, STOP, DESTINATION],
    segments: [SEGMENT],
    travel_legs: [LEG],
    constraints: [],
    ...overrides,
  };
}

const OPTIMIZATION_RESULT: OptimizationResult = {
  optimizedWaypointOrder: ["wp_stop_1"],
  totalTravelMinutes: 20,
  totalIdleMinutes: 0,
  travelEfficiency: 100,
  resourceUtilization: 100,
  optimizationScore: 100,
  improved: false,
};

beforeEach(() => {
  resetRouteOptimizationStore();
});

describe("routeOptimizationStore", () => {
  it("creates a route plan with one initial version in draft status, no optimization result yet", async () => {
    const result = await mockRouteOptimizationRepository.createRoutePlan("ws_1", "member_1", baseInput());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("draft");
    expect(result.data.versions).toHaveLength(1);
    expect(result.data.versions[0].version_number).toBe(1);
    expect(result.data.versions[0].snapshot.optimization_result).toBeNull();
    expect(result.data.versions[0].snapshot.waypoints).toHaveLength(3);
  });

  it("lists route plans for a workspace, excluding archived by default", async () => {
    const created = await mockRouteOptimizationRepository.createRoutePlan("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    await mockRouteOptimizationRepository.setRoutePlanStatus(created.data.id, "ws_1", "archived");

    const activeOnly = await mockRouteOptimizationRepository.listRoutePlansForWorkspace("ws_1");
    expect(activeOnly).toHaveLength(0);
    const withArchived = await mockRouteOptimizationRepository.listRoutePlansForWorkspace("ws_1", true);
    expect(withArchived).toHaveLength(1);
  });

  it("gets a route plan by id, and returns null for one that doesn't exist", async () => {
    const created = await mockRouteOptimizationRepository.createRoutePlan("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");
    const fetched = await mockRouteOptimizationRepository.getRoutePlanById(created.data.id);
    expect(fetched?.id).toBe(created.data.id);
    expect(await mockRouteOptimizationRepository.getRoutePlanById("route_plan_missing")).toBeNull();
  });

  it("sets route plan status and stamps archived_at only on archive", async () => {
    const created = await mockRouteOptimizationRepository.createRoutePlan("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");

    const validated = await mockRouteOptimizationRepository.setRoutePlanStatus(created.data.id, "ws_1", "validated");
    expect(validated.success).toBe(true);
    if (validated.success) expect(validated.data.archived_at).toBeNull();

    const archived = await mockRouteOptimizationRepository.setRoutePlanStatus(created.data.id, "ws_1", "archived");
    expect(archived.success).toBe(true);
    if (archived.success) expect(archived.data.archived_at).not.toBeNull();
  });

  it("appends a new immutable version with the optimization result and reordered structure, keeping constraints from the current version", async () => {
    const created = await mockRouteOptimizationRepository.createRoutePlan("ws_1", "member_1", baseInput());
    if (!created.success) throw new Error("failed to create");

    const reordered = [STOP, ORIGIN, DESTINATION];
    const result = await mockRouteOptimizationRepository.appendOptimizedVersion(created.data.id, "ws_1", { waypoints: reordered, segments: [SEGMENT], travel_legs: [LEG], optimization_result: OPTIMIZATION_RESULT });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.versions).toHaveLength(2);
    const latest = result.data.versions[1];
    expect(latest.version_number).toBe(2);
    expect(latest.snapshot.optimization_result).toEqual(OPTIMIZATION_RESULT);
    expect(latest.snapshot.waypoints).toEqual(reordered);
    expect(latest.snapshot.constraints).toEqual(created.data.versions[0].snapshot.constraints);
    // the prior version's own snapshot is untouched
    expect(created.data.versions[0].snapshot.optimization_result).toBeNull();
  });

  it("errors when setting status on a route plan that doesn't exist", async () => {
    const result = await mockRouteOptimizationRepository.setRoutePlanStatus("route_plan_missing", "ws_1", "validated");
    expect(result.success).toBe(false);
  });

  it("errors when appending an optimized version to a route plan that doesn't exist", async () => {
    const result = await mockRouteOptimizationRepository.appendOptimizedVersion("route_plan_missing", "ws_1", { waypoints: [], segments: [], travel_legs: [], optimization_result: OPTIMIZATION_RESULT });
    expect(result.success).toBe(false);
  });
});
