# Deliverable Engine

`src/core/operationalPlanning/deliverableEngine.ts` — v2.0 Checkpoint 27.2, Step 7.

## What it answers

A `Deliverable` is one of the spec's 7 named types (`physical`/`digital`/`service`/`report`/`document`/`media`/`custom`), tracked through the spec's 4 named statuses (`pending`/`ready`/`delivered`/`rejected`). Pure reads over a plan's own `deliverables` array — this engine tracks state, it never produces or transports an actual deliverable.

## `deliverableCoverage`

```ts
deliverableCoverage(deliverables): DeliverableCoverage  // { total, delivered, ratio }
```

Vacuous `ratio: 1` for a plan with zero deliverables.

## `findIncompleteDeliverables` / `findRejectedDeliverables`

Filter by `status !== "delivered"` / `status === "rejected"` respectively.

## `findOrphanedDeliverables`

```ts
findOrphanedDeliverables(deliverables, realStepIds): Deliverable[]
```

A deliverable whose `produced_by_step_id` doesn't resolve to a real step in this plan. `produced_by_step_id: null` is valid (not produced by any single step) and never counted as orphaned.

## The one honest Knowledge Graph hook — `linked_node`

`Deliverable.linked_node: KnowledgeNodeRef | null` is set only when a deliverable maps to a real, already-created artifact (a Document or MediaAsset) — every deliverable that's still just a plan-time placeholder keeps it `null`. This is the single field that makes `produces_deliverable` (see [`operational-planning.md`](operational-planning.md)'s Knowledge Graph section) a live, honest edge instead of a fabricated one; `buildProducesDeliverableRelationship` (`operationalKnowledgeGraphEngine.ts`) returns `null` whenever either side is unset.

## Consumers

- `operationalConstraintsEngine.ts` — every orphaned deliverable becomes a blocking `missing_deliverables` error.
- `operationalHealthEngine.ts` — `computeDeliverableCoverageScore` = `100 × deliverableCoverage(...).ratio`.
- `operationalRiskEngine.ts` — the `missing_deliverables` finding.
- `operationalPlanningActions.ts` — `addDeliverableAction` persists the deliverable, records `deliverable_added`, and syncs the Knowledge Graph relationship when `linked_node` is set.
