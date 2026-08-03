# Bundle Engine

`src/core/allocation/bundleEngine.ts` — v2.0 Checkpoint 27.1, Step 7.

## What it answers

A `ResourceBundle` (e.g. "Photography Crew") is a reusable template. This engine only ever translates one into requirement lines, and checks how completely a proposed `Allocation`'s candidates fulfill it. It never selects a resource itself — that's `AllocationEngine`'s job.

## `buildRequirementLinesFromBundle`

```ts
buildRequirementLinesFromBundle(bundle): AllocationRequirementLine[]
```

Required lines occupy indices `[0, required_resources.length)`; optional lines follow immediately after — so a caller can always tell "was this line required" from its index alone, without re-consulting the bundle. `createAllocationRequestAction` calls this whenever a caller creates an `AllocationRequest` with a `bundle_id` and no explicit `required_resources`.

## `evaluateBundleCompleteness`

```ts
evaluateBundleCompleteness(bundle, candidates): BundleCompletenessResult
// { requiredLineIndices, optionalLineIndices, fulfilledRequiredCount, fulfilledOptionalCount, isComplete, missingRequiredLines }
```

A line is "fulfilled" when its selected-candidate count meets or exceeds its `quantity`. `isComplete` is true only when every required line is fulfilled — optional lines never block completeness, they only add to `fulfilledOptionalCount`.

## `computeBundleCompletenessScore`

Vacuous **100** for a bundle with zero required lines — the same "not applicable resolves to a pass" discipline `capabilityScoreEngine.ts` established. Otherwise `100 × (fulfilledRequiredCount ÷ requiredLineIndices.length)`.

## Consumers

- `allocationActions.ts` — `analyzeCandidates` calls `evaluateBundleCompleteness` whenever `request.bundle_id !== null`; `createAllocationProposal` records `allocation_bundle_completed` on the Timeline the moment a proposal's bundle becomes complete.
- `allocationValidationEngine.ts` — an incomplete bundle is a blocking `bundle_incomplete` error.
- `allocationRiskEngine.ts` — the `bundle_incomplete` finding.
