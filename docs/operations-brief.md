# Deterministic Operations Brief

`core/operationsCenter/operationsBriefEngine.ts`. Plain template sentences assembled from already-computed data — no external AI provider, no generated facts. If Bloom AI ever surfaces this brief, it must display this result verbatim rather than generating its own summary from raw data.

## Fields, and where each comes from

- **`currentOperationalSummary`** — one template sentence combining `status`, `kpis.activeOperations`, `kpis.pendingAcceptances`, `kpis.criticalAlerts`, `kpis.openIncidents`.
- **`criticalIssues`** — titles of every `critical`-severity item in the already-sorted Priority Queue.
- **`pendingAcceptances`** — `kpis.pendingAcceptances`, straight through.
- **`blockedWork`**/**`highRiskRoutes`** — descriptions of the Priority Queue's own `operation`/`route` type items.
- **`capacityRisks`** — real threshold checks only: scheduling conflicts present, combined capacity usage ≥ 90%, or fewer than 20% of workers available — never a fabricated risk.
- **`resourceAvailabilitySummary`** — one sentence combining `kpis.availableWorkers`/`unavailableWorkers`/`equipmentInUse`/`vehiclesInUse`.
- **`openIncidentsCount`** — the real open-incident list length.
- **`topPriorities`** — the first 5 items of the already-sorted Priority Queue.

## Recent improvements/regressions — the one field that needs history

Operations Center keeps no history of its own — everything else here is computed fresh on every read. `recentImprovements`/`recentRegressions` compare the current KPI snapshot against a `previousKpis` argument the **caller** supplies (`getOperationsBriefAction`'s own optional parameter); without one, both arrays stay empty rather than fabricating a trend. When a previous snapshot is given, 6 named metrics are diffed directionally (decline rate/critical alerts/open incidents: lower is better; dispatch queue health/route health/average execution health: higher is better) and only real, non-zero deltas produce a sentence.
