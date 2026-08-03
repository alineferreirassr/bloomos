import type { RouteValidationResult, RouteHealthScores, TravelEstimate, OptimizationResult, TravelConstraint, RouteExplanation } from "@/types/routeOptimization";
import { isConstraintSatisfied } from "@/core/routeOptimization/routeHealthEngine";

/**
 * v2.0 Checkpoint 30, Step 7 — Route Explanation Engine. Readable prose
 * over already-computed data — mirrors `dispatchExplanationEngine.ts`/
 * `executionExplanationEngine.ts`'s shape exactly. Detects nothing new;
 * every line traces back to a validation error, a declared constraint,
 * or the Optimization/Health/Travel engines' own already-computed
 * output.
 */

export function explainRoute(validation: RouteValidationResult, health: RouteHealthScores, travelEstimate: TravelEstimate, optimization: OptimizationResult | null, constraints: TravelConstraint[], phaseStopCount: number): RouteExplanation {
  const rejectedRouteReasons = validation.valid ? [] : validation.errors.map((e) => e.detail);

  const constraintViolations = constraints.filter((c) => !isConstraintSatisfied(c, travelEstimate, phaseStopCount)).map((c) => c.description || `${c.kind.replace(/_/g, " ")} violated (limit: ${c.limit_value}).`);

  const optimizationDecisions =
    optimization === null
      ? ["No optimization has been run yet."]
      : [`Stop order optimized to: ${optimization.optimizedWaypointOrder.join(" -> ") || "(no intermediate stops)"}`, optimization.improved ? "This order reduces total declared travel time versus the prior order." : "This order does not reduce total declared travel time versus the prior order."];

  const travelEstimateSummary = `Estimated travel: ${travelEstimate.estimatedTravelMinutes}m over ${travelEstimate.estimatedDistanceKm}km; total duration ${travelEstimate.estimatedTotalDurationMinutes}m (idle ${travelEstimate.estimatedIdleMinutes}m).`;

  const optimizationScoreSummary = optimization === null ? "Not yet optimized." : `Optimization score ${optimization.optimizationScore}/100 (travel efficiency ${optimization.travelEfficiency}, resource utilization ${optimization.resourceUtilization}).`;

  const healthSummary = `Overall route health ${health.overallRouteHealth}/100.`;

  const summary = validation.valid ? `Route is valid — ${healthSummary}` : `Route is invalid — ${rejectedRouteReasons[0] ?? "see validation errors."}`;

  return { summary, optimizationDecisions, rejectedRouteReasons, constraintViolations, travelEstimateSummary, optimizationScoreSummary, healthSummary };
}
