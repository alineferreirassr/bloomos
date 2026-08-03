import type { Waypoint, RouteSegment, TravelLeg, OptimizationResult } from "@/types/routeOptimization";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 30, Step 5 — Optimization Engine. A deterministic
 * greedy reorder over already-declared travel figures — not a full
 * TSP solver, and deliberately not one: every `TravelLeg.declared_*`
 * figure in this domain is an ops planner's own input, not a measured
 * distance, so there is no real pairwise distance matrix to optimize
 * against (building one would mean fabricating data nobody declared).
 * The heuristic instead sorts each `phase_stop` waypoint by its own
 * already-declared "cost to reach" — the `declared_travel_minutes` of
 * the leg that currently arrives at it — ascending. Stable-sorted, so
 * with every leg still at its `0` build-time default (the common case
 * this checkpoint, before any real figures are entered) the order never
 * changes and `improved` is honestly `false`. No GPS, no traffic API,
 * no randomness — the same input always produces the same output.
 */

function legMinutesTo(travelLegs: TravelLeg[], toWaypointId: string): number {
  return travelLegs.find((leg) => leg.to_waypoint_id === toWaypointId)?.declared_travel_minutes ?? 0;
}

function findLeg(travelLegs: TravelLeg[], fromId: string, toId: string): TravelLeg | undefined {
  return travelLegs.find((leg) => leg.from_waypoint_id === fromId && leg.to_waypoint_id === toId);
}

export interface OptimizeRouteInput {
  routePlanId: string;
  waypoints: Waypoint[];
  travelLegs: TravelLeg[];
  segments: RouteSegment[];
}

export interface OptimizeRouteOutput {
  optimization: OptimizationResult;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  travelLegs: TravelLeg[];
}

export function optimizeRoute(input: OptimizeRouteInput): OptimizeRouteOutput {
  const origin = input.waypoints.find((w) => w.kind === "origin");
  const destination = input.waypoints.find((w) => w.kind === "destination");
  const middle = input.waypoints.filter((w) => w.kind === "phase_stop");

  const originalTravelMinutes = input.travelLegs.reduce((sum, leg) => sum + leg.declared_travel_minutes, 0);

  if (!origin || !destination) {
    // Nothing to optimize without both bookends — return the input unchanged, a vacuous no-op.
    const optimization: OptimizationResult = { optimizedWaypointOrder: middle.map((w) => w.id), totalTravelMinutes: originalTravelMinutes, totalIdleMinutes: 0, travelEfficiency: 100, resourceUtilization: 100, optimizationScore: 100, improved: false };
    return { optimization, waypoints: input.waypoints, segments: input.segments, travelLegs: input.travelLegs };
  }

  const orderedMiddle = [...middle].sort((a, b) => legMinutesTo(input.travelLegs, a.id) - legMinutesTo(input.travelLegs, b.id));
  const orderedWaypoints = [origin, ...orderedMiddle, destination];

  const workDurationByWaypointId = new Map(input.segments.map((s) => [s.to_waypoint_id, s.work_duration_minutes] as const));

  const newSegments: RouteSegment[] = [];
  const newTravelLegs: TravelLeg[] = [];
  let totalTravelMinutes = 0;

  for (let i = 0; i < orderedWaypoints.length - 1; i++) {
    const from = orderedWaypoints[i];
    const to = orderedWaypoints[i + 1];
    const existingLeg = findLeg(input.travelLegs, from.id, to.id);
    const leg: TravelLeg = existingLeg ?? { id: generateId("travel_leg"), route_plan_id: input.routePlanId, from_waypoint_id: from.id, to_waypoint_id: to.id, declared_distance_km: 0, declared_travel_minutes: 0 };
    newTravelLegs.push(leg);
    totalTravelMinutes += leg.declared_travel_minutes;

    newSegments.push({ id: generateId("route_segment"), route_plan_id: input.routePlanId, sequence_index: i, from_waypoint_id: from.id, to_waypoint_id: to.id, travel_leg_id: leg.id, work_duration_minutes: workDurationByWaypointId.get(to.id) ?? 0 });
  }

  const totalWorkMinutes = newSegments.reduce((sum, s) => sum + s.work_duration_minutes, 0);
  const totalIdleMinutes = 0;

  const totalStops = middle.length;
  const stopsWithWork = middle.filter((w) => (workDurationByWaypointId.get(w.id) ?? 0) > 0).length;

  const travelEfficiency = totalWorkMinutes + totalTravelMinutes === 0 ? 100 : Math.round((totalWorkMinutes / (totalWorkMinutes + totalTravelMinutes)) * 100);
  const resourceUtilization = totalStops === 0 ? 100 : Math.round((stopsWithWork / totalStops) * 100);
  const optimizationScore = Math.round((travelEfficiency + resourceUtilization) / 2);
  const improved = totalTravelMinutes < originalTravelMinutes;

  const optimization: OptimizationResult = {
    optimizedWaypointOrder: orderedMiddle.map((w) => w.id),
    totalTravelMinutes,
    totalIdleMinutes,
    travelEfficiency,
    resourceUtilization,
    optimizationScore,
    improved,
  };

  const reindexedWaypoints = orderedWaypoints.map((w, index) => ({ ...w, sequence_index: index }));
  return { optimization, waypoints: reindexedWaypoints, segments: newSegments, travelLegs: newTravelLegs };
}
