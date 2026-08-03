import type { TravelEstimate, TravelConstraint, OptimizationResult, RouteHealthScores } from "@/types/routeOptimization";

/**
 * v2.0 Checkpoint 30, Step 6 — Route Health Engine. 6 named scores,
 * every one a pure function over already-computed data — no live
 * lookups, no AI. `overallRouteHealth` averages all 5 component scores,
 * inverting `delayRisk` first — the same asymmetric-vacuous-exclusion
 * discipline `dispatchHealthEngine.ts`'s own `declineRate` and
 * `executionHealthEngine.ts`'s own `pauseHealth` already established:
 * a metric that measures badness gets excluded from a plain average
 * unless inverted first, or it would silently pull the composite in the
 * wrong direction.
 */

/** Exported for `routeExplanationEngine.ts` to reuse directly — never a second, duplicate satisfaction check. */
export function isConstraintSatisfied(constraint: TravelConstraint, travelEstimate: TravelEstimate, phaseStopCount: number): boolean {
  switch (constraint.kind) {
    case "max_travel_minutes":
      return travelEstimate.estimatedTravelMinutes <= Number(constraint.limit_value);
    case "max_idle_minutes":
      return travelEstimate.estimatedIdleMinutes <= Number(constraint.limit_value);
    case "max_stops":
      return phaseStopCount <= Number(constraint.limit_value);
    case "earliest_departure_at":
      return travelEstimate.estimatedDepartureAt === null || new Date(travelEstimate.estimatedDepartureAt).getTime() >= new Date(String(constraint.limit_value)).getTime();
    case "latest_arrival_at":
      return travelEstimate.estimatedArrivalAt === null || new Date(travelEstimate.estimatedArrivalAt).getTime() <= new Date(String(constraint.limit_value)).getTime();
  }
}

/** `100` (fully healthy) when no `max_travel_minutes` constraint is declared — nothing to violate yet. Once declared, degrades once the estimate exceeds the limit. */
export function computeTravelHealth(travelEstimate: TravelEstimate, constraints: TravelConstraint[]): number {
  const maxTravel = constraints.find((c) => c.kind === "max_travel_minutes");
  if (!maxTravel) return 100;
  const limit = Number(maxTravel.limit_value);
  if (limit <= 0 || travelEstimate.estimatedTravelMinutes <= limit) return 100;
  return Math.max(0, Math.round((limit / travelEstimate.estimatedTravelMinutes) * 100));
}

/** A direct read of the Optimization Engine's own `travelEfficiency` — vacuous-100 before optimization has ever run (nothing inefficient has been found yet). */
export function computeEfficiencyHealth(optimization: OptimizationResult | null): number {
  return optimization === null ? 100 : optimization.travelEfficiency;
}

/** The one score that runs the opposite direction: higher means *more* risk. Vacuous-0 (no risk) when no `latest_arrival_at` deadline is declared or no arrival estimate exists yet to compare against it; otherwise 1 point of risk per minute the estimated arrival runs past the deadline, capped at 100 — a simple, deterministic, disclosed scale, never a live schedule lookup. */
export function computeDelayRisk(travelEstimate: TravelEstimate, constraints: TravelConstraint[]): number {
  const latestArrival = constraints.find((c) => c.kind === "latest_arrival_at");
  if (!latestArrival || travelEstimate.estimatedArrivalAt === null) return 0;

  const limitTime = new Date(String(latestArrival.limit_value)).getTime();
  const arrivalTime = new Date(travelEstimate.estimatedArrivalAt).getTime();
  if (arrivalTime <= limitTime) return 0;

  const overrunMinutes = Math.round((arrivalTime - limitTime) / 60_000);
  return Math.min(100, overrunMinutes);
}

/** The share of every declared `TravelConstraint` that is currently satisfied — vacuous-100 when no constraints have been declared at all. */
export function computeConstraintHealth(constraints: TravelConstraint[], travelEstimate: TravelEstimate, phaseStopCount: number): number {
  if (constraints.length === 0) return 100;
  const satisfiedCount = constraints.filter((c) => isConstraintSatisfied(c, travelEstimate, phaseStopCount)).length;
  return Math.round((satisfiedCount / constraints.length) * 100);
}

/** A direct read of the Optimization Engine's own `optimizationScore` — vacuous-100 before optimization has ever run. */
export function computeOptimizationHealth(optimization: OptimizationResult | null): number {
  return optimization === null ? 100 : optimization.optimizationScore;
}

export interface ComputeRouteHealthInput {
  travelEstimate: TravelEstimate;
  constraints: TravelConstraint[];
  optimization: OptimizationResult | null;
  phaseStopCount: number;
}

export function computeRouteHealthScores(input: ComputeRouteHealthInput): RouteHealthScores {
  const travelHealth = computeTravelHealth(input.travelEstimate, input.constraints);
  const efficiencyHealth = computeEfficiencyHealth(input.optimization);
  const delayRisk = computeDelayRisk(input.travelEstimate, input.constraints);
  const constraintHealth = computeConstraintHealth(input.constraints, input.travelEstimate, input.phaseStopCount);
  const optimizationHealth = computeOptimizationHealth(input.optimization);
  const overallRouteHealth = Math.round((travelHealth + efficiencyHealth + (100 - delayRisk) + constraintHealth + optimizationHealth) / 5);

  return { travelHealth, efficiencyHealth, delayRisk, constraintHealth, optimizationHealth, overallRouteHealth };
}
