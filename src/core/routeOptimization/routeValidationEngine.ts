import type { RouteValidationInput, RouteValidationResult, RouteValidationIssue, Waypoint, RouteSegment } from "@/types/routeOptimization";

/**
 * v2.0 Checkpoint 30, Step 4 — Route Validation Engine. "Reject invalid
 * routes" — 7 named checks, all blocking errors. The first 5 are plain
 * facts the caller resolves from live Dispatch/Execution Package state
 * (this engine never fetches anything itself, never recalculates
 * Allocation/Dispatch to answer them); the last 2 are structural
 * properties of the route graph itself, checked directly against the
 * `waypoints`/`segments` handed in.
 */

function issue(rule: string, detail: string): RouteValidationIssue {
  return { rule, detail };
}

/** No waypoint id repeated, and no `phase_stop` waypoint referencing the same `phase_id` twice — a phase gets exactly one stop. */
function hasDuplicateStops(waypoints: Waypoint[]): boolean {
  const seenIds = new Set<string>();
  const seenPhaseIds = new Set<string>();
  for (const waypoint of waypoints) {
    if (seenIds.has(waypoint.id)) return true;
    seenIds.add(waypoint.id);
    if (waypoint.phase_id !== null) {
      if (seenPhaseIds.has(waypoint.phase_id)) return true;
      seenPhaseIds.add(waypoint.phase_id);
    }
  }
  return false;
}

/** Walks the route from its `origin` waypoint following each segment's own `from -> to` edge; a revisited waypoint means the route loops back on itself. */
function hasCircularRoute(waypoints: Waypoint[], segments: RouteSegment[]): boolean {
  const origin = waypoints.find((w) => w.kind === "origin");
  if (!origin) return false;

  const nextWaypointId = new Map(segments.map((s) => [s.from_waypoint_id, s.to_waypoint_id] as const));
  const visited = new Set<string>();
  let current: string | undefined = origin.id;
  while (current !== undefined) {
    if (visited.has(current)) return true;
    visited.add(current);
    current = nextWaypointId.get(current);
  }
  return false;
}

export function validateRoute(input: RouteValidationInput): RouteValidationResult {
  const errors: RouteValidationIssue[] = [];

  if (!input.assignmentExists) {
    errors.push(issue("assignment_missing", "No Dispatch Assignment exists for this route."));
  }
  if (!input.workerAssigned) {
    errors.push(issue("worker_not_assigned", "No worker is assigned to this route."));
  }
  if (!input.vehicleAssignedPlaceholder) {
    errors.push(issue("vehicle_placeholder_failed", "Vehicle assignment placeholder check failed."));
  }
  if (!input.executionPackageApproved) {
    errors.push(issue("package_not_approved", "The execution package has not been approved."));
  }
  if (!input.dispatchActive) {
    errors.push(issue("dispatch_inactive", "The source dispatch is no longer active."));
  }
  if (hasCircularRoute(input.waypoints, input.segments)) {
    errors.push(issue("circular_route_detected", "This route loops back through a waypoint it already visited."));
  }
  if (hasDuplicateStops(input.waypoints)) {
    errors.push(issue("duplicate_stops_detected", "This route visits the same stop more than once."));
  }

  return { valid: errors.length === 0, errors, warnings: [] };
}
