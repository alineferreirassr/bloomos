# Resource Overview

`core/operationsCenter/resourceOverviewEngine.ts`. Reuses Workforce's own already-computed outputs only — no new eligibility, availability, or utilization calculation happens here, per the spec's own explicit instruction.

## Worker availability — folding 9 states into 3

No public Workforce action currently exposes the real `AvailabilitySummary` (`computeAvailabilitySummary`'s own 9-state breakdown: available/onAssignment/busy/onBreak/offDuty/vacation/sickLeave/training/unavailable) directly — it's only baked into `WorkforceScorecard`. `operationsCenterActions.ts`'s `gatherSourceData` shims a coarser version from the two real numbers the Scorecard already computed (`availableNow`, `onAssignmentNow`):

- `available` → `scorecard.availableNow`
- `onAssignment` → `scorecard.onAssignmentNow`
- everything else folded into `offDuty` as a disclosed coarser bucket (`totalWorkers - availableNow - onAssignmentNow`)

`resourceOverviewEngine.ts` itself then folds this into the view's own 3 buckets: `workersAvailable` (`available`), `workersBusy` (`onAssignment + busy`), `workersOffline` (everything else). `workersInActiveOperations` reuses `onAssignment` directly — the same already-computed figure, read a second time for a different question Resource Overview asks.

## Equipment/vehicles

`equipmentAvailable`/`equipmentAssigned`/`equipmentUnavailable` and their vehicle equivalents split straight off `EquipmentUtilization`/`VehicleUtilization` (`availableCount`, `inUseCount`, `maintenanceCount + retiredCount`) — Workforce's own already-computed utilization figures, not re-filtered from raw `Equipment[]`/`Vehicle[]` records.

## Teams active

`teamsActive` reuses `WorkforceScorecard.teamsCount` verbatim — already computed as `teams.filter(t => t.status === "active").length` inside `workforceScorecardEngine.ts`.

## Critical single points of failure

`criticalSinglePointsOfFailure: string[]` is accepted as a plain input array. Capability's own Coverage/Risk engines (Checkpoint 26.1) would be the real source for "only one worker holds this certification," but no call site wires that lookup into Resource Overview yet — rather than invent a new eligibility calculation to fill the gap, the field stays empty until a future pass supplies real items.
