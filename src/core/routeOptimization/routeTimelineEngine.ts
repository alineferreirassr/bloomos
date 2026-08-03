import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 30, Step 8 — Route Timeline Engine. Pure mapping from
 * a route lifecycle event to the Timeline entry it produces — mirrors
 * `executionTimelineEngine.ts`'s shape exactly. `routeOptimizationActions.ts`
 * calls these only on a real transition, never on every read/re-evaluation,
 * the same "avoid Timeline noise" discipline every prior checkpoint's
 * Timeline integration follows.
 */
export interface RouteTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function routeCreatedEvent(): RouteTimelineEvent {
  return { type: "route_created", description: "Route plan created." };
}

export function routeOptimizedEvent(score: number): RouteTimelineEvent {
  return { type: "route_optimized", description: `Route optimized (score ${score}/100).` };
}

export function routeValidatedEvent(): RouteTimelineEvent {
  return { type: "route_validated", description: "Route validated." };
}

export function routeApprovedEvent(): RouteTimelineEvent {
  return { type: "route_approved", description: "Route approved." };
}

export function routeArchivedEvent(): RouteTimelineEvent {
  return { type: "route_archived", description: "Route archived." };
}

export function optimizationRecalculatedEvent(score: number): RouteTimelineEvent {
  return { type: "optimization_recalculated", description: `Optimization recalculated (score ${score}/100).` };
}
