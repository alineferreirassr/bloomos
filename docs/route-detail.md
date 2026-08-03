# Route Detail

`src/modules/routeOptimization/components/RouteDetailView.tsx`, route `/route-optimization/[id]` — v2.0 Checkpoint 30, Step 13 (spec's Step 12, "Route Detail").

## What it shows

One route plan's full picture, sourced from its current (latest) version's own frozen `RouteSnapshot`:

- **KPIs**: Waypoints, Segments, Constraints, Versions.
- **Evaluation** (on demand): all 6 named health scores, the travel estimate's own figures (travel time, distance, idle time, total duration), the optimization score summary, the explanation summary, optimization decisions, rejected-route reasons, constraint violations, and any validation errors.
- **Waypoints**: every waypoint in sequence order, labeled with its own `kind` (`origin`/`phase_stop`/`destination`).
- **Constraints**: every declared `TravelConstraint`, its kind, description, and declared limit value.
- **Timeline**: every `RouteVersion`, newest first, showing its version number, whether it carries an optimization result (and at what score), and when it was created.

## `evaluateRoutePlanAction` is wired directly — the one deliberate exception

The same pattern `FieldOperationDetailView.tsx`'s `evaluateFieldOperationAction` establishes: every other Detail view in this codebase is read-only plus one "Evaluate" button, and this one follows suit. `evaluateRoutePlanAction` is a genuine re-derivation of already-computed data (re-runs `RouteValidationEngine`/`TravelEstimationEngine`/`RouteHealthEngine`/`RouteExplanationEngine` against the current snapshot) — never a mutation.

## Optimize/validate/approve/archive actions exist and are fully tested, but no button calls them yet

`optimizeRoutePlanAction`, `validateRoutePlanAction`, `approveRoutePlanAction`, and `archiveRoutePlanAction` are built, tested, and ready — but `RouteDetailView` doesn't wire a click handler to any of them. The same disclosed "no create/mutate control wired yet" scope every prior platform's Detail view in this codebase carries.

## "Timeline" here means the plan's own version history, not the global Timeline feed

The spec's Step 12 names "Timeline" as one of the Detail view's required sections. Rather than duplicating the workspace-wide Timeline feed the 6 named events (`route_created`, etc.) are already recorded into via `recordTimelineActivity`, this view renders the exact version history those events are emitted alongside — `RoutePlan.versions`. Every new version corresponds 1:1 to a real "Route Optimized"/"Optimization Recalculated" transition; nothing is re-fetched from a second source.

## Waypoints and constraints are read directly from the snapshot, not from `Evaluate`

Unlike health/travel/optimization figures (which require a live re-derivation), the plan's own waypoints and declared constraints are already sitting on the persisted `RoutePlan` — the view renders them immediately on load, without waiting for the "Evaluate" button.

## No display name — the same short-id convention every prior Detail view uses

A `RoutePlan` has no `title`/`name` field of its own — it's reserved vocabulary in the Knowledge Graph, matching its own lack of node identity. The view renders `Route Plan #${routePlan.id.slice(-8)}`, the same stable, readable short-id pattern `Order #${order.id.slice(-8)}`/`Field Operation #${operation.id.slice(-8)}` established.
