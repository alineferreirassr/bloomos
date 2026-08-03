# Checklist Engine

`src/core/operationalPlanning/checklistEngine.ts`, `lib/data/mock/checklistTemplatesStore.ts` — v2.0 Checkpoint 27.2, Step 9.

## Two shapes, one relationship — reusable templates → frozen snapshots

`ChecklistTemplate` (workspace-owned, `CHECKLIST_KINDS`: `task`/`safety`/`quality`/`customer`/`vehicle`/`equipment`/`custom`) is structural only — item labels, no completion state. A `PlanChecklist` attached to a plan is a **frozen snapshot** of a template at attach time (`template_id !== null`), or an ad-hoc one (`template_id === null`) — the same "snapshot, not a live reference" discipline `ChecklistItem.template_snapshot` established for Events. Completion state lives directly on the snapshot's own `items`, never re-derived from the (possibly since-edited) live template.

## `attachChecklistFromTemplateAction`

`operationalPlanningActions.ts` copies a `ChecklistTemplate`'s `name`/`kind`/items onto a fresh `PlanChecklist` with new item ids, all `completed: false` — editing the source template afterward never changes an already-attached checklist.

## `checklistCompletionRatio` / `isChecklistComplete`

```ts
checklistCompletionRatio(checklist): number   // vacuous 1 for zero items
isChecklistComplete(checklist): boolean       // every item completed
findIncompleteChecklists(checklists): PlanChecklist[]
```

## Template Registry — `checklistTemplatesStore.ts`

`createTemplate` validates a non-blank name and at least one item; `setTemplateStatus` (`"active"`/`"archived"`) writes `archived_at` on archive and clears it on reactivation. Same convention as `resourceBundlesStore.ts`.

## Consumers

- `operationalHealthEngine.ts` — `computeChecklistCoverageScore` averages `checklistCompletionRatio` across every attached checklist (vacuous 100 for zero checklists).
- `operationalRiskEngine.ts` — the `missing_checklist` finding fires when an `active`/`approved` plan has zero attached checklists.
- `operationalPlanningActions.ts` — `toggleChecklistItemAction` flips one item's `completed` flag in place.

## UI

No creation form for `ChecklistTemplate` is wired — `createChecklistTemplateAction`/`archiveChecklistTemplateAction`/`reactivateChecklistTemplateAction` exist and are fully tested, exercised directly in tests, ready for a future Settings-style registry screen.
