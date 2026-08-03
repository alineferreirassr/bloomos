# Priority Engine

v2.0 Checkpoint 25.7, Step 2. `core/executiveDecisions/priorityEngine.ts` computes a deterministic 0-100 composite score from named factors, then buckets it into one of 5 priorities. No randomness, no AI — every weight is a disclosed constant.

```ts
export interface DecisionFactors {
  businessImpactCount: number;
  dependencyCount: number;
  unmetDependencyCount: number;
  blockingRelationshipsCount: number;
  operationalReadiness: number | null;
  objectiveBlocked: boolean;
  businessRuleSeverity: "hard" | "soft" | null;
  ageDays: number;
  riskFlag: boolean;
}
```

Every factor the spec names (Business Impact, Dependency Count, Blocking Relationships, Operational Readiness, Objective Status, Business Rule Severity, Age, Risk) has a real field.

## The weights

| Factor | Contribution | Cap |
|---|---|---|
| `businessImpactCount` | ×10 per unit | 30 |
| `unmetDependencyCount` | ×15 per unit | 30 |
| `blockingRelationshipsCount` | ×10 per unit | 20 |
| `operationalReadiness` | `(100 - readiness) × 0.2` | 20 |
| `objectiveBlocked` | flat +15 | — |
| `businessRuleSeverity === "hard"` | flat +15 | — |
| `ageDays` | ×0.5 per day | 15 |
| `riskFlag` | flat +10 | — |

The sum is clamped to 100. Caps exist so no single factor alone can push a Decision into `"critical"` — a real composite of risk signals is required.

## Bucketing

| Score | Priority |
|---|---|
| ≥ 80 | critical |
| ≥ 60 | high |
| ≥ 35 | medium |
| ≥ 15 | low |
| < 15 | informational |

## Priority is refreshed, not fixed at creation

A Decision's priority is computed once at draft time (`ageDays: 0`, via `executiveDecisionEngine.ts`), then **recomputed on every subsequent `evaluateExecutiveDecisionsAction()` call** for every still-open Decision, using its real elapsed age (`decisionEngine.deriveDecisionAgeDays`) and current dependency/objective state. When the recomputed priority differs from the stored one, `executiveDecisionsActions.ts` calls `setDecisionPriority` and records a `decision_priority_changed` Timeline event (`executiveTimelineEngine.decisionPriorityTimelineEvent`) — this is genuinely how an unresolved issue's priority rises over time in this checkpoint, not a static label.

## Readiness resolution (Closing Fix)

`operationalReadiness` is now populated with a real value on every live evaluation, resolved by `decisionEngine.resolveDecisionReadiness` — never a new readiness calculation, only a lookup over values `evaluateBusinessHealthAction()` (Step 15.5) and `evaluateObjectivesAction()` (Step 15.6) already computed.

### Source resolution — preference order, most specific first

| Priority | Source | Where the value comes from |
|---|---|---|
| 1 | `proposal` / `event` / `client` / `vendor` | The matching `ReadinessScore.overallScore` (Step 15.5) for a node in the Decision's own `related_entities` |
| 2 | `objective` | `ObjectiveProgress.completionPercent` (Step 15.6) for a linked Objective in `related_objective_ids` |
| 3 | `workspace` | `BusinessHealthReport.overallScore` (Step 15.5) — used when the Decision has no `related_entities` at all, or one explicitly typed `"workspace"` |
| 4 | `fallback` | The documented neutral value, `50` — used only when none of the above apply (an unsupported entity type — `media_asset`, `document`, `contract`, `invoice`, `media_folder`, etc. — with no Objective link and no workspace scoping) |

Entity-level readiness is checked first because it's the most specific signal available for that Decision; Objective progress is the next-best proxy when a Decision is tied to a goal rather than a single entity; workspace-wide Business Health is a real, already-computed number and is preferred over the neutral fallback whenever the Decision is workspace-scoped.

### Fallback behavior — never a silent 0

0 on this 0-100 scale means "completely unready" everywhere else it's used (`ReadinessScore.overallScore`, `ObjectiveProgress.completionPercent`). Silently assigning it to a Decision this engine has no real opinion about would fabricate a false "worst possible state" signal and inflate its priority for no real reason. The fallback is **50** — the scale's midpoint, read as "unknown," not "unready" — and every `ReadinessResolution` carries `isFallback: true` when this path is taken, so a fallback is never confused with a real measurement.

### Score direction

Confirmed unchanged and correct: `computeReadinessPriorityContribution(readiness) = min((100 - readiness) × 0.2, 20)`. Readiness near 0 makes `(100 - readiness)` large, contributing close to the full 20-point cap — **low readiness increases priority**. Readiness near 100 contributes close to 0 — **high readiness does not inflate priority**. This formula was already correct before the Closing Fix; the fix was supplying it a real `readiness` value instead of always `null`.

### Normalization

No renormalization was needed — every readiness source already reports on the same 0-100 scale (`ReadinessScore.overallScore`, `ObjectiveProgress.completionPercent`, `BusinessHealthReport.overallScore` are all 0-100 by construction), so `resolveDecisionReadiness` passes the source value straight through.

### Weighting — no double-counting

Readiness feeds `priorityEngine.computePriorityScore`'s composite (capped at 20 of the 100 points) and nothing else. It is **not** added into `decisionScoringEngine.ts`'s `urgencyScore`, `businessImpactScore`, `riskScore`, or `complexityScore` — those already represent age, business-rule severity, impact count, and dependency count respectively, and adding readiness into them too would apply the same signal twice. `computeDecisionScores` now takes the resolved `ReadinessResolution` as an explicit second parameter and attaches it to the returned `DecisionScores.readiness` purely as traceability metadata — it never participates in any of those four formulas.

### Traceability

Every `DecisionScores` (Step 6's own result shape — no second scoring model was created) carries a `readiness: ReadinessResolution` field:

```ts
interface ReadinessResolution {
  source: "proposal" | "event" | "client" | "vendor" | "objective" | "workspace" | "fallback";
  value: number;              // 0-100, the readiness value actually applied
  isFallback: boolean;        // true only for source: "fallback"
  priorityContribution: number; // points this value added to the priority composite
}
```

This answers all four traceability questions directly: which source was used (`source`), what value was applied (`value`), how it affected the score (`priorityContribution`, computed via the same `computeReadinessPriorityContribution` function `priorityEngine.ts` uses internally — no duplicated formula), and whether a fallback was used (`isFallback`).
