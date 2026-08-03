# Operations KPIs

`core/operationsCenter/operationsKpiEngine.ts`. 18 named figures — the spec's own count matches `OperationalKpiSnapshot`'s own 18 fields exactly. Every one is derived from data this checkpoint already has; none are placeholders.

| KPI | Source |
|---|---|
| `activeOperations`/`pausedOperations`/`blockedOperations` | `Snapshot.liveOperations.{active,paused,blocked}FieldOperations` |
| `pendingAcceptances` | `Snapshot.liveOperations.pendingAssignments` |
| `declineRate` | `declinedAssignments / (accepted + declined)` — 0 when nothing has been responded to yet |
| `dispatchQueueHealth` | `acceptedAssignments / (accepted + declined + expired + pending)` as a 0-100 acceptance ratio — vacuous-100 with no assignments |
| `routeHealth` | Average of `Route.health.overallRouteHealth` across every real route result |
| `highRiskRoutes`/`schedulingConflicts` | `Snapshot.liveOperations.highRiskRoutes` / `Snapshot.schedulingConflicts`, straight through |
| `capacityUsage` | `(workersUnavailable + equipmentUnavailable + vehiclesUnavailable) / totalResourceCount` — reuses the Snapshot's own "unavailable" proxy (see [`operational-snapshot.md`](operational-snapshot.md)), never a new calculation |
| `availableWorkers`/`unavailableWorkers` | `Snapshot.workersAvailable`/`workersUnavailable`, straight through |
| `equipmentInUse`/`vehiclesInUse` | `Snapshot.equipmentUnavailable`/`vehiclesUnavailable` — the same coarse "unavailable ⇒ presumed in use" proxy |
| `criticalAlerts` | Count of open/acknowledged/escalated alerts with `severity === "critical"` |
| `openIncidents` | Count of incidents with `status !== "resolved"` |
| `averageExecutionHealth` | Average of Field Operations' own `ExecutionHealthScores.overallOperationalHealth`, reused directly from `evaluateFieldOperationsPlatformHealthAction`'s results — never recalculated |
| `overallOperationalStatus` | The Status Engine's own output, passed straight through |

No KPI here re-derives a number a source module already computed; every arithmetic KPI (`declineRate`, `dispatchQueueHealth`, `capacityUsage`) is a documented combination of already-real counts, not a recalculation of any module's own internal formula.
