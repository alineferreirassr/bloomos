# Allocation Dependency Engine

`src/core/allocation/dependencyEngine.ts` — v2.0 Checkpoint 27.1, Step 8. (Not to be confused with `docs/dependency-engine.md`, Checkpoint 25's unrelated Knowledge Graph Dependency & Impact Engine.)

## What it answers

Does a proposed candidate (e.g. a Drone) have its required co-allocated resource (e.g. a certified operator) actually present in the same allocation?

## Reuse, not reimplementation

Certification validity is checked via Checkpoint 26.1's real `evaluateCertificationCapability`/`isCertificationStateBlocking` (`certificationCapabilityEngine.ts`) — this file never re-derives what "does this worker hold a valid certification" means. Skill matching is a direct `worker.skills.some(s => s.name === rule.requires_skill)` check against Checkpoint 26's real `Worker.skills`.

## Scoped to worker-targeted dependencies, by design

```ts
export interface DependencyRule {
  subject_resource_type: ResourceType;
  subject_identifier: string | null;   // e.g. an Equipment `category`; null = every resource of this type
  requires_resource_type: ResourceType;
  requires_skill: string | null;
  requires_certification: string | null;
  description: string;
}
```

`findApplicableRules` only ever matches rules where `requires_resource_type === "worker"` — skill and certification are Worker-only concepts in this codebase. `requires_resource_type` stays generic in the type for a future checkpoint that might define equipment-to-equipment or equipment-to-vehicle dependencies; this engine deliberately doesn't fabricate that logic now.

## `checkDependencies`

```ts
checkDependencies({ rules, subjectResourceType, subjectIdentifier, selectedWorkers, now }): DependencyCheckResult[]
```

A dependency is satisfied only by co-allocation — a worker already selected elsewhere in the *same* allocation, never a worker outside the proposal. `satisfiedByResourceId` names the worker who satisfied it, or `null`.

## Consumers

- `allocationValidationEngine.ts` — an unsatisfied dependency is a blocking `dependency_unsatisfied` error.
- `allocationScoreEngine.ts` — `dependencyHealthScore` = ratio of satisfied rules.
- `allocationActions.ts` — records `allocation_dependency_failed` on the Timeline for each unsatisfied rule, and persists a `depends_on` Knowledge Graph edge for each satisfied one.
- `allocationRiskEngine.ts` — the `critical_dependency` finding.
