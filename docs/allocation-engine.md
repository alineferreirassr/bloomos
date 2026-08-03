# Allocation Engine

`src/core/allocation/allocationEngine.ts` — v2.0 Checkpoint 27.1, Steps 4 & 6.

## What it answers

Given an already-known-eligible pool of candidates per requirement line, which ones should fill each line — and in what priority order? Never dispatches, never reserves, never schedules; only proposes.

## The one design decision that keeps this honest

`AllocationEngine` never re-evaluates eligibility, availability, or scheduling itself. Every `CandidatePoolEntry` arrives pre-resolved by the caller (`allocationActions.ts`), which builds it from Checkpoint 26.1's real `evaluateCapabilityRequirementAction` for workers (capability requirement set) or simple status checks for other resource types (team/equipment/vehicle active/available) and vendors. This file's only job is *selecting among an already-known-eligible pool* — the same "translate, don't duplicate" discipline every integration engine in this codebase follows.

```ts
interface CandidatePoolEntry {
  resource_type: ResourceType;
  resource_id: string;
  eligible: boolean;
  ineligibleReason: string | null;   // populated only when eligible: false
  score: number;                     // 0-100, already computed by the caller
  currentWorkload: number;           // active Assignments (workers) or active-allocation usage (everything else)
  isPreferred: boolean;              // caller-supplied, only meaningful for the "custom" strategy
}
```

## The 7 strategies — every one a total order, tie-broken on `resource_id`

| Strategy | Primary sort | Tie-break |
|---|---|---|
| `highest_capability` | `score` descending | `resource_id` |
| `lowest_cost` | `score` descending (honest no-op — no cost/rate field exists anywhere) | `resource_id` |
| `least_busy` | `currentWorkload` ascending | `score` desc, then `resource_id` |
| `balanced_workload` | `score − currentWorkload × 5` descending | `resource_id` |
| `preferred_team` / `preferred_worker` | `preferred_resource_ids.includes(resource_id)` first | `score` desc, then `resource_id` |
| `custom` | `isPreferred` first | `score` desc, then `resource_id` |

Ties always break on `resource_id` — results stay reproducible across runs, never arbitrary.

## `buildAllocationProposal`

```ts
buildAllocationProposal({ requirementLines, candidatePoolsByLineIndex, strategy, maxBackupsPerLine? }): { candidates, fallbackChains }
```

Per line: filters the pool into eligible/ineligible, ranks the eligible ones by strategy, selects the top `quantity`. Every candidate — selected, unselected-but-eligible, or ineligible — gets an `AllocationCandidate` row with a real reason when not selected. For `quantity: 1` lines, a `FallbackChain` (primary + up to `maxBackupsPerLine` backups, default 2) is also built via [`fallback-engine.md`](fallback-engine.md); multi-quantity lines still record every extra eligible candidate as an unselected row with a rejection reason, just without a formal chain.

An empty pool (asset/custom resource type, or a workspace with none of the needed resource type registered) produces zero candidates for that line — not an error. That's the real "no resource could be allocated at all" state `AllocationRiskEngine`'s `no_allocation_possible` finding exists to catch.
