# Milestone Engine

`src/core/operationalPlanning/milestoneEngine.ts` — v2.0 Checkpoint 27.2, Step 6.

## What it answers

A `Milestone` (Title, optional `target_phase_id`, Completion Criteria, linked `evidence_requirement_ids`, whether Approval Is Required, Status) marks a meaningful checkpoint within a plan. Pure reads over a plan's own `milestones` array — progress tracking, never a live status transition (that's the module layer's job: `completeMilestoneAction` in `operationalPlanningActions.ts`).

## `milestoneProgress`

```ts
milestoneProgress(milestones): MilestoneProgress  // { total, completed, ratio }
```

Vacuous `ratio: 1` (100%-equivalent) for a plan with zero milestones — same "not applicable resolves to a pass" discipline every score engine in this codebase follows.

## `findBlockedMilestones` / `findIncompleteMilestones`

Filter by `status === "blocked"` / `status !== "completed"` respectively.

## `findOrphanedMilestones`

```ts
findOrphanedMilestones(milestones, realPhaseIds): Milestone[]
```

A milestone whose `target_phase_id` doesn't resolve to a real phase in this plan. `target_phase_id: null` is valid (a whole-plan milestone) and never counted as orphaned.

## Consumers

- `operationalConstraintsEngine.ts` — every orphaned milestone becomes a blocking `missing_milestones` error.
- `operationalHealthEngine.ts` — `computeMilestoneCoverageScore` = `100 × milestoneProgress(...).ratio`.
- `operationalExplanationEngine.ts` — `findIncompleteMilestones` feeds `OperationalExplanation.incompleteMilestones`.
- `operationalPlanningActions.ts` — `completeMilestoneAction` transitions status and records the `milestone_completed` Timeline event.
