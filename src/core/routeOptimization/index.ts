import { mockRouteOptimizationRepository } from "@/lib/data/mock/routeOptimizationStore";

export type { RoutePlan, RoutePlanStatus, RouteVersion, RouteSnapshot } from "@/types/routeOptimization";
export type { CreateRoutePlanInput, AppendOptimizedVersionInput, RouteOptimizationRepository } from "@/lib/data/mock/routeOptimizationStore";

/** v2.0 Checkpoint 30 — Mock-only accessors, same precedent as `core/dispatch`/`core/fieldOperations`. No Supabase table exists yet for any Route Optimization concept. */
export function getCoreRouteOptimizationService() {
  return mockRouteOptimizationRepository;
}
