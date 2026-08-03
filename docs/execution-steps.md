# Execution Step Engine

`src/core/operationalPlanning/executionStepEngine.ts` — v2.0 Checkpoint 27.2, Steps 4-5.

## What it answers

An `ExecutionStep` (Title, Description, Instructions, Estimated Duration, Dependencies, Assigned Resource Type, Required Capability, Priority, Status, Notes) lives inline on its phase — see `types/operationalPlanning.ts`'s own module-level doc comment for why. This file only ever *reads* that structure: it never selects, assigns, or schedules a step, and it never mutates one (that's `operationalPlanningActions.ts`'s job, via `updatePlan`).

## `flattenSteps` / `findStepById`

```ts
flattenSteps(phases): ExecutionStep[]
findStepById(phases, stepId): ExecutionStep | null
```

The one shared traversal every other engine in this checkpoint builds on top of.

## Step dependencies — 3 types × 3 classes, independent axes

`DEPENDENCY_TYPES` (`finish_to_start`/`start_to_start`/`finish_to_finish`) describes *when* a dependency applies; `DEPENDENCY_CLASSES` (`optional`/`blocking`/`critical`) describes *how strictly* it must hold — orthogonal, so a `StepDependency` carries both independently.

## `findBrokenDependencies`

```ts
findBrokenDependencies(phases): BrokenDependency[]  // { stepId, missingStepId }
```

Every dependency whose `step_id` doesn't resolve to a real step anywhere in the plan — a broken *reference*, distinct from a cycle.

## `detectDependencyCycle`

```ts
detectDependencyCycle(phases): DependencyCycleResult  // { hasCycle, cycleStepIds }
```

DFS-based cycle detection over the step dependency graph (edge: `step → dependency.step_id`) using standard white/gray/black coloring. Dangling references are silently skipped here — that's `findBrokenDependencies`'s job, a distinct validation concern from "does a cycle exist among the real steps." Returns the first cycle found, in cycle order.

## Consumers

- `operationalConstraintsEngine.ts` — a cycle is a blocking `broken_dependencies` error; a broken reference is also `broken_dependencies`.
- `operationalHealthEngine.ts` — `computeDependencyHealthScore` returns `0` (not a vacuous pass) when a real cycle exists — the one deliberate exception to this checkpoint's "not applicable resolves to a pass" scoring discipline.
- `criticalPathEngine.ts` — assumes the graph is already confirmed acyclic by this file; never re-checks.
