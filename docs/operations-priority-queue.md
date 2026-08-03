# Operational Priority Queue

`core/operationsCenter/priorityQueueEngine.ts`. A read-oriented merge of items every other engine in this checkpoint (or an existing module) already produces — explicitly **not a second Executive Decision Engine**: nothing here re-scores or re-prioritizes anything, it only reads each item's own already-assigned severity and places it in one merged, sorted list.

## What gets merged

`buildPriorityQueue` pulls from 8 named categories, matching `PRIORITY_QUEUE_ITEM_TYPES`: open critical alerts, open incidents, still-open critical executive decisions (priority/status read straight through, never re-derived — the explicit "do not create a second Executive Decision Engine" guard), a single aggregate item when objectives are blocked (never one item per objective), blocked field operations, routes above the delay-risk threshold, pending dispatch acceptances, and real scheduling conflicts (`overbooked_schedule`/`recurring_conflict`/`holiday_conflict`).

## Bottlenecks — accepted, not fabricated

`bottlenecks: PriorityQueueItem[]` is accepted as a plain input array and passed through unchanged. No module in this codebase currently exposes a "this exact resource is a bottleneck" signal, so rather than invent one, the engine leaves the door open for a future detector to supply real items without needing an interface change.

## Sorting

`sortPriorityQueue` orders by `SEVERITY_RANK` (`critical` → `informational`) only — deterministic, and ties preserve the merge's own insertion order (alerts, then incidents, then decisions, and so on), so the result never depends on iteration order of any underlying collection.

## Deep links

Each item type links to its own real detail route where one exists: alerts/incidents to `/operations-center/alerts|incidents/{id}`, field operations to `/field-operations/{id}`, routes to `/route-optimization/{id}`, dispatch acceptances to `/dispatch/{id}`. Executive decisions link to `/assets/executive-decisions` (no per-id detail route exists for that platform yet); objectives and scheduling conflicts have no deep link (`null`).
