# Executive Queue

v2.0 Checkpoint 25.7, Step 4. `core/executiveDecisions/executiveQueueEngine.ts` produces the single ordered list the spec's own Success Criteria calls "the primary starting point for company leadership every day." Deterministic ordering only — no randomness, no re-scoring.

## Eligibility

```ts
function isQueueEligible(decision: Decision): boolean {
  return decision.status !== "resolved" && decision.status !== "archived";
}
```

`open`, `in_progress`, and `escalated` decisions are all queue-eligible — an escalated decision doesn't leave the queue, it just (almost always) sorts higher, since escalation only ever fires alongside a priority bump in practice.

## Ordering

Three-key sort, each key breaking ties in the one before it:

1. **Priority bucket** — critical, then high, medium, low, informational.
2. **`DecisionScores.overallExecutiveScore` descending** (Step 6) — already computed, never re-derived here.
3. **`created_at` ascending** (older first) — the final tiebreaker, so two decisions of identical priority and score don't visibly reorder themselves between one evaluation and the next just because of insertion order.

```ts
function orderExecutiveQueue(decisions: Decision[], scoresById: Map<string, DecisionScores>): Decision[]
function buildExecutiveQueue(decisions: Decision[], scoresById: Map<string, DecisionScores>): Decision[] // filters to isQueueEligible first
```

## Spec examples, and where each one actually comes from

| Example | Real source |
|---|---|
| Resolve Missing Contract | `evaluateProposalCompleteness`'s "Missing Contract" (Step 15.5), via a readiness `suggestedNextSteps` recommendation |
| Assign Event Owner | `evaluateEventCompleteness`'s "Missing Team" (Step 15.5) |
| Approve Proposal | `evaluateProposalCompleteness`'s "Missing Approval" (Step 15.5) |
| Upload Hero Image | `evaluateProposalCompleteness`'s "Missing Hero Image", or the `event_requires_at_least_one_hero_image` constraint (Step 10.7) |
| Archive Duplicate Assets | `knowledgeHealthEngine.findDuplicateRelationships` (Step 12) — honestly "duplicate relationship," not a literal duplicate-file detector; see `docs/executive-decision-engine.md` |
| Resolve Broken Relationship | `knowledgeHealthEngine.findBrokenRelationships` (Step 12) |
| Review Expired Document | `Document.expires_at` past `now`, fetched directly by `executiveDecisionsActions.ts` |
| Complete Missing Metadata | An Objective's own `required_metadata` requirement (Step 15.6), surfaced via that Objective's `ObjectiveHealth.recommendations` |

## Where it's used

`modules/executiveDecisions/executiveDecisionsActions.ts`'s `evaluateExecutiveDecisionsAction()` calls `buildExecutiveQueue` once, after every Decision has been re-scored for the current evaluation — the queue is always built from the *current* priorities and scores, never a stale snapshot. `ExecutiveDashboardView.tsx`'s "Executive Queue" card renders the top 10, with the full list available via a lazy-expanded "All Decisions" section (Step 16 — see `docs/executive-dashboard.md`).
