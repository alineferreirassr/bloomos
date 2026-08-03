# Allocation Validation, Scoring, Explanation & Comparison

`src/core/allocation/{allocationValidationEngine,allocationScoreEngine,allocationExplanationEngine,allocationComparisonEngine}.ts` — v2.0 Checkpoint 27.1, Steps 11–14.

## Allocation Validation Engine — the single "can this be approved" gate

```ts
validateAllocation({ requirementLines, candidates, dependencyResults, bundleCompleteness, capacityChecks, sharedResourceConflictCount }): AllocationValidationResult
```

Capability/Schedule/Availability failures are never re-derived here — they're already encoded on each `AllocationCandidate.rejection_reason` by whichever real engine (Checkpoint 26.1's `EligibilityEngine`, Checkpoint 27's `AvailabilityWindowEngine`/`ConflictEngine`) rejected that candidate upstream. This file only checks whether *enough* candidates survived (`insufficient_quantity`), plus every dependency/bundle/capacity result the caller passes in:

| Rule | Blocks (`errors`) or warns (`warnings`) |
|---|---|
| `insufficient_quantity` | Blocks |
| `dependency_unsatisfied` | Blocks |
| `bundle_incomplete` | Blocks |
| `capacity_exceeded` | Blocks |
| `shared_resource_conflict` | Warns only |

## Allocation Score Engine — 8 disclosed formulas

| Score | Meaning | Vacuous case |
|---|---|---|
| `capabilityFitScore` | Average quality of selected candidates | **`0`**, not vacuous — the one deliberate exception |
| `scheduleFitScore` | Does the calendar's own time window accommodate this request | `100` |
| `availabilityFitScore` | Real-time worker availability at the request's start | `100` |
| `bundleCompletenessScore` | See `bundle-engine.md` | `100` |
| `dependencyHealthScore` | Ratio of satisfied dependency rules | `100` |
| `capacityHealthScore` | Ratio of capacity checks within limit | `100` |
| `preferenceMatchScore` | Ratio of selected candidates matching a line's `preferred_resource_ids` | `100` |
| `overallAllocationScore` | Unweighted average of the other seven | — |

`capabilityFitScore` deliberately breaks the "vacuous pass" pattern every other score here follows: it's `0`, not `100`, when requirements existed but nothing could be selected — that's the one score whose entire purpose is surfacing "we found zero qualified candidates." Every other score measures "quality of what was selected," a genuinely different question that's meaningless with nothing selected, so those stay vacuous-100.

## Allocation Explanation Engine — never expose only a score

```ts
explainAllocation(candidates, scores, validation, fallbackChains, bundleCompleteness): AllocationExplanation
// { summary, selectedReasons, rejectedReasons, missingResources, constraintFailures, fallbacksUsed, bundleCompletion }
```

Every selected/rejected candidate gets a one-line human reason. `fallbackChains` exists for API symmetry, but the real "was a fallback used" signal always comes from each candidate's own `is_fallback`/`fallback_tier` — set once, at selection time (see `fallback-engine.md`).

## Allocation Comparison Engine — comparing Proposal A/B/C

```ts
compareAllocations(proposals: ComparisonProposalInput[]): AllocationComparisonResult
```

Every strength (`≥ 90`)/weakness (`< 60`)/difference (`≥ 20`-point spread across proposals) is a disclosed threshold over `AllocationScores` — never a judgment call. Names the proposal with the highest `overallAllocationScore` and calls out any score that varies significantly across the compared set.

## How `allocationActions.ts` composes them

`analyzeCandidates` calls dependency/bundle/capacity/shared-conflict checks, then `computeAllocationScores` → `validateAllocation` → `explainAllocation`, in that order — the exact same pipeline whether generating a brand-new proposal (`createAllocationProposal`) or re-deriving an existing one's scores without re-selecting (`reEvaluateAllocationAction`/`compareAllocationProposalsAction`).
