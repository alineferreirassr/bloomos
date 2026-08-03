# Route Optimization Dashboard

`src/modules/routeOptimization/components/RouteOptimizationDashboardView.tsx`, route `/route-optimization` — v2.0 Checkpoint 30, Step 11.

## What it shows

- **KPIs**: Route Plans (count), Average Optimization Score, Findings (count), Average Route Health.
- **Constraint Violations**: every route plan whose live-evaluated `health.constraintHealth` is below 100, with its constraint health score and a link through to Detail.
- **Status Distribution**: a count of route plans in each non-zero `RoutePlanStatus` (`draft`/`validated`/`approved`/`archived`), rendered as one badge per status.
- **High-Severity Findings** / **Other Findings**: `RouteFinding[]` from `evaluateRouteOptimizationPlatformHealthAction`, split by severity — the same two-section split every prior platform dashboard in this codebase uses.
- **Route Plans list**: every plan in the workspace, sorted newest-first, each row showing priority, version count, optimization score (when one exists), health, and status, linking to `/route-optimization/[id]`.

## Read-only, one shared data source

Every figure comes straight from `evaluateRouteOptimizationPlatformHealthAction`'s already-computed `{ results, findings }` — no GPS, no live tracking, no external map/traffic provider happens inside the Dashboard itself. A "Refresh" button re-runs the same action; there is no create/mutate control wired (see [`route-optimization.md`](route-optimization.md)'s disclosed gap).

## Constraint Violations vs. the `travel_constraint` finding — two lenses, one data source

"Constraint Violations" and the `travel_constraint` finding both describe the identical condition (`health.constraintHealth < 100`) but are surfaced as two separate sections for the same reason Field Operations' own "Blocked Operations" vs. `execution_blocked` split exists: a direct, actionable list vs. the full findings feed (which also carries informational findings like `healthy_route`/`optimization_opportunity`). Neither section re-derives health; both read the same `evaluateRouteOptimizationPlatformHealthAction` result.
