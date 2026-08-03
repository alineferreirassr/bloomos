# Route Validation Engine

`src/core/routeOptimization/routeValidationEngine.ts` — v2.0 Checkpoint 30, Step 4.

## The 7 named checks — all blocking errors, no warnings

```ts
validateRoute(input: RouteValidationInput): RouteValidationResult
```

| Check | Rule id | Failing condition |
|---|---|---|
| Assignment Exists | `assignment_missing` | No Dispatch Assignment exists for this route |
| Worker Assigned | `worker_not_assigned` | No `resource_type === "worker"` assignment exists on the order |
| Vehicle Assigned Placeholder | `vehicle_placeholder_failed` | Always passes — see below |
| Execution Package Approved | `package_not_approved` | The execution package's `status !== "approved"` |
| Dispatch Active | `dispatch_inactive` | The order isn't `"dispatched"`, or the assignment isn't `"accepted"` |
| No circular routes | `circular_route_detected` | Walking the route from its `origin` waypoint revisits a waypoint already visited |
| No duplicate stops | `duplicate_stops_detected` | Two waypoints share an id, or two `phase_stop` waypoints reference the same `phase_id` |

The first 5 are plain facts the caller resolves from live Dispatch/Execution Package state (this engine never fetches anything itself, never recalculates Allocation/Dispatch to answer them); the last 2 are structural properties of the route graph itself, checked directly against the `waypoints`/`segments` handed in.

## "Vehicle Assigned Placeholder" — the spec's own name for a disclosed no-op

Route Optimization has no vehicle-specific constraint of its own yet — the caller always passes `vehicleAssignedPlaceholder: true`, so this check never actually blocks a route today. It exists so a future checkpoint that introduces real vehicle-routing constraints has a named slot to wire real logic into, without changing `RouteValidationInput`'s own shape. Mirrors the exact "named placeholder that never fires yet" precedent Dispatch's own `completed_placeholder` established.

## Structural checks — computed directly, not caller-supplied

Unlike the first 5 checks, "no circular routes" and "no duplicate stops" are pure functions over the route's own `waypoints`/`segments` — no external fact needed. `hasCircularRoute` walks the chain of `from -> to` edges starting at the `origin` waypoint and flags a revisit; `hasDuplicateStops` checks for a repeated waypoint id or a repeated `phase_id` among `phase_stop` waypoints.

## "Reject invalid routes"

Every one of the 7 checks is a blocking error — none are merely informational, since none of them describe a state a route could safely proceed under. `errors.length === 0` is the only condition for `valid: true`.
