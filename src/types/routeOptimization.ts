import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { ExecutionPriority, ExecutionStatus } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 30 — Route Optimization Platform. Dispatch (28) assigns
 * work. Field Operations (29) executes work and tracks its state. Route
 * Optimization calculates and manages the ROUTE that work is performed
 * along — it never executes work, never modifies Dispatch/Field
 * Operations state, never performs GPS tracking, never calls an
 * external map/traffic provider, and introduces no AI. Every engine in
 * this domain is a pure, deterministic function; no randomness.
 *
 * There is no real geography anywhere in this codebase — no address,
 * coordinate, or GPS field exists on any prior domain type this
 * platform reuses. Rather than invent one (which would edge toward
 * real mapping, forbidden by the Stop Condition), every "travel" figure
 * here is a *declared* input — a plain number an ops planner enters
 * once, the same way `ExecutionStep.estimated_duration_minutes` is
 * author-declared, never GPS/traffic-derived. `TravelLeg.declared_distance_km`/
 * `declared_travel_minutes` are that declaration; every engine downstream
 * only ever sums/compares/derives from numbers already sitting on these
 * records — never a live measurement, never an external call.
 *
 * Naming pair, disclosed: the spec's own Step 1 names both "Route" and
 * "Route Plan" as separate nouns. `RoutePlan` is the persisted, versioned
 * aggregate (mirrors `ExecutionPackage`'s own Package → Version →
 * Snapshot shape exactly — one per Dispatch Assignment, `versions:
 * RouteVersion[]`, each version's own frozen `RouteSnapshot`).
 * `Route` is a plain **computed, never-stored** convenience view over a
 * plan's current version — the ordered waypoints/segments/travel legs a
 * caller actually renders — never a second source of truth that could
 * drift from the plan's own frozen snapshot.
 *
 * `RoutePlanStatus` reuses `ExecutionStatus` (`draft`/`validated`/
 * `approved`/`archived`) directly — the same reuse-by-alias precedent
 * `DispatchPriority = ExecutionPriority` established before it; a route
 * plan's lifecycle is the same shape as an execution package's own.
 */

// ---- Route Plan shell (mirrors ExecutionPackage's Package/Version/Snapshot shape) ----

export type RoutePlanStatus = ExecutionStatus;

export interface RoutePlan {
  id: string;
  workspace_id: string;
  /** The Dispatch Order this plan's work came from — pinned, never re-resolved. */
  dispatch_order_id: string;
  /** The one Dispatch Assignment this Route Plan exists for. */
  dispatch_assignment_id: string;
  execution_package_id: string;
  /** The exact immutable `ExecutionVersion` this plan routes work for. */
  execution_version_id: string;
  /** The Operational Plan the frozen Execution Snapshot names — reused, never rebuilt. `null` when the snapshot names none. */
  operational_plan_id: string | null;
  priority: ExecutionPriority;
  /** Reused from the source Execution Package's own context — never re-resolved independently. */
  context: KnowledgeNodeRef | null;
  status: RoutePlanStatus;
  versions: RouteVersion[];
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

/** One immutable, frozen optimization run — a fresh version is appended every time "Optimization Recalculated" fires, never mutating a prior version's own snapshot. */
export interface RouteVersion {
  id: string;
  route_plan_id: string;
  version_number: number;
  snapshot: RouteSnapshot;
  created_at: string;
}

/** The frozen bundle one `RouteVersion` carries — mirrors `ExecutionSnapshot`'s own "everything needed, captured once" shape. */
export interface RouteSnapshot {
  id: string;
  captured_at: string;
  waypoints: Waypoint[];
  segments: RouteSegment[];
  travel_legs: TravelLeg[];
  constraints: TravelConstraint[];
  /** `null` until the Optimization Engine has run at least once against this snapshot's own waypoints. */
  optimization_result: OptimizationResult | null;
}

// ---- Route structure ----

export const WAYPOINT_KINDS = ["origin", "phase_stop", "destination"] as const;
export type WaypointKind = (typeof WAYPOINT_KINDS)[number];

/** One ordered stop along the route. No coordinates, no address — `label` and `phase_id` are the only identity a waypoint carries, deliberately abstract to stay clear of real geography. */
export interface Waypoint {
  id: string;
  route_plan_id: string;
  sequence_index: number;
  kind: WaypointKind;
  label: string;
  /** The frozen `ExecutionPhase` this stop performs work for — `null` for the synthetic `origin`/`destination` bookends every route carries. */
  phase_id: string | null;
}

/** The travel-only hop between two consecutive waypoints. `declared_*` fields are author-supplied estimates, never measured. */
export interface TravelLeg {
  id: string;
  route_plan_id: string;
  from_waypoint_id: string;
  to_waypoint_id: string;
  declared_distance_km: number;
  declared_travel_minutes: number;
}

/** One ordered leg of the overall itinerary — travel to a waypoint, then the work performed once there. Distinct from `TravelLeg`: a segment is the composite ("go here, then do this"); a `TravelLeg` is purely the movement portion a segment references. */
export interface RouteSegment {
  id: string;
  route_plan_id: string;
  sequence_index: number;
  from_waypoint_id: string;
  to_waypoint_id: string;
  travel_leg_id: string;
  /** Summed `estimated_duration_minutes` across the destination waypoint's own frozen phase steps — reused, never recalculated. `0` for the synthetic `origin`/`destination` bookends. */
  work_duration_minutes: number;
}

export const TRAVEL_CONSTRAINT_KINDS = ["max_travel_minutes", "max_idle_minutes", "max_stops", "earliest_departure_at", "latest_arrival_at"] as const;
export type TravelConstraintKind = (typeof TRAVEL_CONSTRAINT_KINDS)[number];

/** A declared limit on the route — an ops planner's own input, the same "declared, not measured" discipline every travel figure in this domain follows. */
export interface TravelConstraint {
  id: string;
  route_plan_id: string;
  kind: TravelConstraintKind;
  /** Minutes/stop-count for every kind except the two `_at` kinds, which carry an ISO timestamp instead. */
  limit_value: number | string;
  description: string;
}

// ---- Computed results (never stored) ----

export interface RouteValidationIssue {
  rule: string;
  detail: string;
}

export interface RouteValidationResult {
  valid: boolean;
  errors: RouteValidationIssue[];
  warnings: RouteValidationIssue[];
}

/** Every real-world fact `RouteValidationEngine` needs but cannot resolve itself — the caller reads live Dispatch/Package state and hands it in as plain booleans, plus the route's own structural data for the two graph-shape checks. */
export interface RouteValidationInput {
  assignmentExists: boolean;
  workerAssigned: boolean;
  /** Always `true` this checkpoint — Route Optimization has no vehicle-specific constraint of its own yet; disclosed placeholder, the spec's own name for it. */
  vehicleAssignedPlaceholder: boolean;
  executionPackageApproved: boolean;
  dispatchActive: boolean;
  waypoints: Waypoint[];
  segments: RouteSegment[];
}

export interface TravelEstimate {
  estimatedTravelMinutes: number;
  estimatedDistanceKm: number;
  /** `null` when the route has no declared start time to depart from. */
  estimatedDepartureAt: string | null;
  /** `null` when the route has no declared start time to compute against. */
  estimatedArrivalAt: string | null;
  estimatedIdleMinutes: number;
  estimatedTotalDurationMinutes: number;
}

export interface OptimizationResult {
  /** Waypoint ids in the Optimization Engine's own proposed sequence — the destination-only stops, never re-ordering the synthetic origin/destination bookends. */
  optimizedWaypointOrder: string[];
  totalTravelMinutes: number;
  totalIdleMinutes: number;
  travelEfficiency: number;
  resourceUtilization: number;
  optimizationScore: number;
  /** Whether the optimized order actually differs from the snapshot's own current waypoint order. */
  improved: boolean;
}

export interface RouteHealthScores {
  travelHealth: number;
  efficiencyHealth: number;
  /** The one score on this engine that runs the opposite direction — higher means *more* risk, not more health. Excluded (inverted) from `overallRouteHealth`'s own average, the same `declineRate`/`pauseHealth` asymmetric-vacuous precedent every prior health engine in this codebase discloses. */
  delayRisk: number;
  constraintHealth: number;
  optimizationHealth: number;
  overallRouteHealth: number;
}

export interface RouteExplanation {
  summary: string;
  optimizationDecisions: string[];
  rejectedRouteReasons: string[];
  constraintViolations: string[];
  travelEstimateSummary: string;
  optimizationScoreSummary: string;
  healthSummary: string;
}

/** The full, computed-only picture one evaluation of a `RoutePlan` produces — a plain assembled view, never a second stored source of truth. */
export interface Route {
  routePlan: RoutePlan;
  snapshot: RouteSnapshot;
  validation: RouteValidationResult;
  travelEstimate: TravelEstimate;
  optimization: OptimizationResult | null;
  health: RouteHealthScores;
  explanation: RouteExplanation;
}

export const ROUTE_FINDING_TYPES = ["low_route_efficiency", "high_delay_risk", "travel_constraint", "optimization_opportunity", "healthy_route"] as const;
export type RouteFindingType = (typeof ROUTE_FINDING_TYPES)[number];

export const ROUTE_FINDING_SEVERITIES = ["low", "medium", "high"] as const;
export type RouteFindingSeverity = (typeof ROUTE_FINDING_SEVERITIES)[number];

export interface RouteFinding {
  id: string;
  type: RouteFindingType;
  severity: RouteFindingSeverity;
  description: string;
  relatedRoutePlanId: string | null;
}
