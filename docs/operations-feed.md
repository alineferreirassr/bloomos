# Operations Feed

`core/operationsCenter/operationsFeedEngine.ts`. A pure, computed-only merge of every event source this checkpoint has real data for — never a second Timeline store.

## Named sources

`buildOperationalFeed({alerts, incidents, timelineActivity}, pinnedIds)` merges 9 named builders: alert-opened, alert-acknowledged, alert-resolved, alert-dismissed, alert-escalated (one item per lifecycle timestamp actually present on each `OperationalAlert`), incident-opened, incident-acknowledged, incident-resolved (same, off `OperationalIncident`), and reused-timeline-activity (one item per `TimelineActivity`, wrapping the existing, workspace-wide Timeline platform — never a second store).

## Category attribution

Alert/Incident feed items take their `category` straight from the source record. Incidents have no `category` field of their own (they group alerts that may span several) — `representativeCategory` looks up the incident's own first linked alert in the same batch and uses that alert's category; falls back to `"timeline"` (the most neutral category) only when no linked alert can be resolved. Reused Timeline activity is categorized `"timeline"` uniformly, since `TimelineActivity` carries an `EntityType` (`owner_type`), not an `OperationalCategory`, and no reliable mapping between the two exists across every source module.

## Filtering and sorting

`filterFeed(items, {category, sourceNodeId, occurredAfter, occurredBefore, pinnedOnly})` — every filter is optional and composable. `sortFeedChronological` (pinned first, then newest-first) and `sortFeedByPriority` (pinned first, then most-severe-first by `OperationalSeverity`, severity-less items — reused Timeline activity — sorting last) are the two named views Step 8 asks for.

## Pinning

Every feed item's `id` is deterministic (`${alertId}:opened`, `${incidentId}:resolved`, `timeline:${activityId}`) so a caller-supplied `pinnedIds: Set<string>` can mark items pinned without the engine persisting anything itself. No store for pinned-item ids exists yet this checkpoint — see the disclosed gap in [`operations-center.md`](operations-center.md).

## Deep links

Alert/incident feed items link to `/operations-center/alerts/{id}`/`/operations-center/incidents/{id}`; reused Timeline activity items have no deep link (`null`) since no per-activity detail route exists across the codebase.
