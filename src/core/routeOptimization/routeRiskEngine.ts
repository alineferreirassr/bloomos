import type { RouteValidationResult, RouteHealthScores, OptimizationResult, RouteFinding, RouteFindingSeverity } from "@/types/routeOptimization";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 30, Step 10 — Executive Integration's risk detection
 * half. 5 named, deterministic detectors over already-computed data —
 * no AI, no randomness, no new evaluation logic. The caller
 * (`routeOptimizationActions.ts`) resolves every validation/health/
 * optimization result via `RouteValidationEngine`/`RouteHealthEngine`/
 * `OptimizationEngine`, this file re-implements none of it.
 */

const HEALTHY_THRESHOLD = 80;
const LOW_EFFICIENCY_THRESHOLD = 60;
const HIGH_DELAY_RISK_THRESHOLD = 60;

function finding(type: RouteFinding["type"], severity: RouteFindingSeverity, description: string, relatedRoutePlanId: string): RouteFinding {
  return { id: generateId("route_finding"), type, severity, description, relatedRoutePlanId };
}

export interface RouteRiskInput {
  routePlanId: string;
  validation: RouteValidationResult;
  health: RouteHealthScores;
  optimization: OptimizationResult | null;
}

export function detectRouteRisks(inputs: RouteRiskInput[]): RouteFinding[] {
  const findings: RouteFinding[] = [];

  for (const input of inputs) {
    const { routePlanId, validation, health, optimization } = input;
    const label = `Route plan "${routePlanId}"`;

    // 1. Low Route Efficiency
    if (optimization !== null && optimization.travelEfficiency < LOW_EFFICIENCY_THRESHOLD) {
      findings.push(finding("low_route_efficiency", "medium", `${label} has low travel efficiency (${optimization.travelEfficiency}/100).`, routePlanId));
    }

    // 2. High Delay Risk
    if (health.delayRisk > HIGH_DELAY_RISK_THRESHOLD) {
      findings.push(finding("high_delay_risk", "high", `${label} has a high delay risk (${health.delayRisk}/100).`, routePlanId));
    }

    // 3. Travel Constraint
    if (health.constraintHealth < 100) {
      findings.push(finding("travel_constraint", "medium", `${label} currently violates one or more declared travel constraints.`, routePlanId));
    }

    // 4. Optimization Opportunity — a route that has never been optimized at all.
    if (optimization === null) {
      findings.push(finding("optimization_opportunity", "low", `${label} has not been optimized yet.`, routePlanId));
    }

    // 5. Healthy Route
    if (validation.valid && health.overallRouteHealth >= HEALTHY_THRESHOLD) {
      findings.push(finding("healthy_route", "low", `${label} is healthy (${health.overallRouteHealth}/100).`, routePlanId));
    }
  }

  return findings;
}
