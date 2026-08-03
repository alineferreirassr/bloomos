import type { TravelLeg, RouteSegment, TravelEstimate } from "@/types/routeOptimization";

/**
 * v2.0 Checkpoint 30, Step 3 — Travel Estimation Engine. Pure,
 * deterministic arithmetic over already-declared `TravelLeg`/
 * `RouteSegment` figures — never a live measurement, never an external
 * map/traffic call.
 *
 * `estimatedIdleMinutes` is always `0` this checkpoint — a disclosed
 * placeholder, not a fabricated figure. Real idle time (a worker
 * arriving before work is allowed to start) would need per-waypoint
 * scheduled time windows, and that data belongs to Scheduling (27),
 * never duplicated here. The field exists and is computed so a future
 * checkpoint can wire real windows in without changing this shape.
 */

export interface ComputeTravelEstimateInput {
  travelLegs: TravelLeg[];
  segments: RouteSegment[];
  /** When the route may depart its origin — `null` when no start time has been declared, in which case arrival/departure stay `null` too (nothing to add minutes to). */
  departureAt: string | null;
}

export function computeTravelEstimate(input: ComputeTravelEstimateInput): TravelEstimate {
  const estimatedTravelMinutes = input.travelLegs.reduce((sum, leg) => sum + leg.declared_travel_minutes, 0);
  const estimatedDistanceKm = input.travelLegs.reduce((sum, leg) => sum + leg.declared_distance_km, 0);
  const totalWorkMinutes = input.segments.reduce((sum, segment) => sum + segment.work_duration_minutes, 0);
  const estimatedIdleMinutes = 0;
  const estimatedTotalDurationMinutes = estimatedTravelMinutes + totalWorkMinutes + estimatedIdleMinutes;

  const estimatedDepartureAt = input.departureAt;
  const estimatedArrivalAt = input.departureAt === null ? null : new Date(new Date(input.departureAt).getTime() + estimatedTotalDurationMinutes * 60_000).toISOString();

  return { estimatedTravelMinutes, estimatedDistanceKm, estimatedDepartureAt, estimatedArrivalAt, estimatedIdleMinutes, estimatedTotalDurationMinutes };
}
