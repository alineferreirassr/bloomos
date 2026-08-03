# Operational Progress Engine

`src/core/fieldOperations/operationalProgressEngine.ts` — v2.0 Checkpoint 29, Step 8.

## The frozen plan never changes; the session's own overlay does

The Execution Package's frozen `ExecutionSnapshot.phases`/`milestones`/`deliverables`/`checklists` are read-only — they never change once the package version is created. Real execution progress instead lives on the `ExecutionSession` itself, as a set of live overlay fields:

```ts
current_phase_id: string | null;
completed_step_ids: string[];
completed_milestone_ids: string[];
completed_checklist_item_ids: string[];
completed_deliverable_ids: string[];
```

`computeOperationalProgress` combines the two — frozen plan data plus the session's own live overlay — to produce an `OperationalProgress`, never mutating the plan and never treating the plan's own status fields as if they reflected real execution.

```ts
computeOperationalProgress(input: ComputeOperationalProgressInput): OperationalProgress
```

| Field | Derivation |
|---|---|
| `completedStepIds` / `remainingStepIds` | Every step across every phase, partitioned by `completed_step_ids` membership |
| `completedMilestoneIds` / `pendingMilestoneIds` | Every milestone, partitioned by `completed_milestone_ids` membership |
| `checklistProgress` | `ratio()` of completed checklist items across every frozen `PlanChecklist` |
| `deliverableProgress` | `ratio()` of completed deliverables — a genuinely live count, never the frozen `Deliverable.status` |
| `currentPhaseId` | The session's own explicit `current_phase_id` if set, else derived (see below) |
| `evidenceProgressPlaceholder` | Always `null` — the spec's own line; no evidence capture this checkpoint |

`ratio(completed, total)` is vacuous-100 when there's nothing of that kind to track (e.g., a plan with no deliverables at all) — the codebase-wide "no data yet is the good state" convention.

## Deriving the current phase when none is set explicitly

```ts
deriveCurrentPhaseId(phases, completedStepIds): string | null
```

Sorts phases by `order`, returns the first phase with any incomplete step, or the last phase once every step everywhere is done. Only consulted when `session.current_phase_id` is `null` — a caller (via `updateSessionProgressAction`) can always set it explicitly instead.

## The disclosed mid-build gap — `completed_deliverable_ids`

While designing deliverable-progress tracking, an initial pass only carried live overlays for steps/milestones/checklist items — deliverables would have permanently reflected the frozen snapshot's own never-changing `Deliverable.status`. Caught before the module layer was written; `completed_deliverable_ids` was added to `ExecutionSession` and threaded through `fieldOperationsStore.ts`'s `buildInitialSession`/`updateSessionProgress`.
