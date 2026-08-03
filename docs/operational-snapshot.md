# Operational Snapshot & Status Engines

`core/operationsCenter/operationalSnapshotEngine.ts` and `core/operationsCenter/operationalStatusEngine.ts`. Both are pure functions over already-fetched, already-typed data — neither ever calls a module action or store itself; that is the Cross-Module Aggregation Engine's own job.

## Snapshot Engine — `computeOperationalSnapshot`

Takes a `SnapshotSourceData` bundle (dispatch orders, field operations, route plans/results, scheduling findings, allocation findings, package readiness, workforce scorecard/equipment/vehicle utilization, critical executive decisions, blocked objectives count, business/knowledge health scores, recent Timeline activity) plus the Aggregation Engine's own `sourceOutcomes`/`confidence`, and produces one `OperationalSnapshot` — active/pending/accepted/declined/expired dispatch counts, active/paused/blocked/completed field operation counts, active/high-risk route counts, scheduling conflicts, capacity alerts, allocation risks, execution packages not ready, worker/equipment/vehicle availability, critical decisions, blocked objectives, business/knowledge health scores, and the last 25 Timeline activities.

**Worker/equipment/vehicle availability is read from Workforce's own already-computed outputs, never recalculated.** `Worker.status` is an employment lifecycle field (`active`/`inactive`/`on_leave`/`terminated`), deliberately distinct from real availability — using it as an availability proxy would have violated Step 12's "do not perform new eligibility calculations." Instead, `workersAvailable`/`workersUnavailable` come from `WorkforceScorecard.availableNow`/`totalWorkers` (`evaluateWorkforceAction`'s own already-computed scorecard), and equipment/vehicle availability come from `EquipmentUtilization.availableCount`/`VehicleUtilization.availableCount`.

## Status Engine — `computeOperationalStatus`

A pure, deterministic function over the Snapshot's own already-aggregated facts — six named statuses, most-severe-wins:

- **`unknown`** — nothing was ever fetched (`sourceOutcomes.length === 0`).
- **`degraded`** — too much of the aggregation is stale/missing to trust a judgment (`confidence < 50`) — about the *aggregation itself*, not the operation.
- **`critical`** — a critical executive decision is open, an execution package isn't ready, a field operation is blocked, or business/knowledge health has collapsed below 40.
- **`at_risk`** — a high-risk route, an allocation risk, a scheduling conflict exists, or business/knowledge health is below 70.
- **`attention`** — a capacity alert, a declined/expired assignment, a paused field operation exists, or business/knowledge health is below 90.
- **`normal`** — none of the above.

`degraded`/`unknown` intentionally outrank every operational fact: if the data can't be trusted, no operational judgment is rendered on top of it.
