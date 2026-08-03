# Operations Center Health Composition

`core/operationsCenter/operationsCenterHealthEngine.ts`. Composes 10 existing health outputs into one `OperationsCenterHealthScores` — never recalculates any module's own internal health formula.

## Component sourcing

| Component | Source | Method |
|---|---|---|
| `dispatchHealth` | `DispatchHealthScores.overallDispatchHealth` per order | Averaged |
| `executionHealth` | `ExecutionHealthScores.overallOperationalHealth` per field operation | Averaged |
| `routeHealth` | `RouteHealthScores.overallRouteHealth` per route result | Averaged |
| `schedulingHealth` | `SchedulingScores.calendarHealthScore` per calendar | Averaged |
| `packageHealth` | `PackageHealthScores.overallPackageHealth` per package | Averaged |
| `businessHealth` | `BusinessHealthReport.overallScore` | Reused verbatim |
| `objectiveHealth` | `WorkspaceScorecard.overallOperationalScore` | Reused verbatim |
| `allocationHealth` | Count of high/medium-severity `AllocationFinding`s | `100 - high*10 - medium*5`, floored at 0 — a disclosed severity-count penalty proxy since Resource Allocation exposes findings, not a single bulk score |
| `knowledgeHealth` | Count of every `KnowledgeHealthReport` issue list (broken relationships, orphaned assets, duplicate groups, circular groups, constraint violations) | `100 - issueCount*5`, floored at 0 — a disclosed normalization step over already-computed lists, not a recalculation of `computeKnowledgeHealth`'s own logic |
| `workforceHealth` | `WorkforceScorecard.availableNow / totalWorkers` | A ratio of two numbers the Scorecard already computed — never a new availability/eligibility calculation |

## Weighting — documented, unweighted average

`overallOperationsCenterHealth` is an **unweighted average of all 10 component scores**. No single input feeds more than one component (each module's own health figure maps to exactly one composition slot), so there is no double counting between them.

## Vacuous-good defaults

Every averaged component defaults to `100` when its input array is empty (no records to score yet); `workforceHealth` is vacuous-100 when `totalWorkers === 0`. This is the same "nothing declared yet is not a failure" discipline every prior health engine in this codebase established.
