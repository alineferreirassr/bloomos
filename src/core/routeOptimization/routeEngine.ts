import type { ExecutionPhase } from "@/types/operationalPlanning";
import type { Waypoint, RouteSegment, TravelLeg } from "@/types/routeOptimization";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 30, Step 2 — Route Builder. Creates a Route Plan's
 * structural content from an already-accepted Dispatch Assignment and
 * an already-approved Execution Package's frozen snapshot — mirrors
 * `fieldOperationEngine.ts`'s own minimal eligibility gate exactly, plus
 * the actual waypoint/segment/travel-leg assembly Step 2 asks for.
 * Never recalculates Allocation: `evaluateRouteEligibility` reads only
 * the Dispatch Assignment's own `queue_state` and the Execution
 * Package's own `status` — which resource was selected for which
 * requirement line was already decided by Allocation/Dispatch, and is
 * never re-derived here.
 */

export interface RouteEligibilityInput {
  assignmentQueueState: string;
  packageStatus: string;
}

export interface RouteEligibilityResult {
  canBuild: boolean;
  reason: string | null;
}

export function evaluateRouteEligibility(input: RouteEligibilityInput): RouteEligibilityResult {
  if (input.assignmentQueueState !== "accepted") {
    return { canBuild: false, reason: "The Dispatch Assignment has not been accepted yet." };
  }
  if (input.packageStatus !== "approved") {
    return { canBuild: false, reason: "The source execution package has not been approved." };
  }
  return { canBuild: true, reason: null };
}

export interface RouteStructure {
  waypoints: Waypoint[];
  segments: RouteSegment[];
  travelLegs: TravelLeg[];
}

/**
 * One waypoint per frozen `ExecutionPhase` (ordered by `phase.order`),
 * bookended by a synthetic `origin` and `destination` stop — a route
 * always has somewhere to start from and someone to return to, even
 * though no real address exists for either. `TravelLeg.declared_*`
 * fields start at `0` — a disclosed "not yet declared" default, never a
 * fabricated realistic-looking distance. An ops planner would enter the
 * real figures; no UI wires that mutation yet, the same disclosed gap
 * every prior platform dashboard in this codebase carries.
 */
export function buildRouteStructure(routePlanId: string, phases: ExecutionPhase[]): RouteStructure {
  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  const waypoints: Waypoint[] = [
    { id: generateId("waypoint"), route_plan_id: routePlanId, sequence_index: 0, kind: "origin", label: "Origin", phase_id: null },
    ...sortedPhases.map((phase, index) => ({ id: generateId("waypoint"), route_plan_id: routePlanId, sequence_index: index + 1, kind: "phase_stop" as const, label: phase.name, phase_id: phase.id })),
    { id: generateId("waypoint"), route_plan_id: routePlanId, sequence_index: sortedPhases.length + 1, kind: "destination" as const, label: "Destination", phase_id: null },
  ];

  const travelLegs: TravelLeg[] = [];
  const segments: RouteSegment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];
    const leg: TravelLeg = { id: generateId("travel_leg"), route_plan_id: routePlanId, from_waypoint_id: from.id, to_waypoint_id: to.id, declared_distance_km: 0, declared_travel_minutes: 0 };
    travelLegs.push(leg);

    const destinationPhase = sortedPhases.find((p) => p.id === to.phase_id);
    const workDurationMinutes = destinationPhase ? destinationPhase.steps.reduce((sum, step) => sum + step.estimated_duration_minutes, 0) : 0;

    segments.push({ id: generateId("route_segment"), route_plan_id: routePlanId, sequence_index: i, from_waypoint_id: from.id, to_waypoint_id: to.id, travel_leg_id: leg.id, work_duration_minutes: workDurationMinutes });
  }

  return { waypoints, segments, travelLegs };
}
