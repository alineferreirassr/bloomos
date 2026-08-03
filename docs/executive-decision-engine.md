# Executive Decision Engine

v2.0 Checkpoint 25.7, Step 1. `core/executiveDecisions/executiveDecisionEngine.ts` converts already-computed findings from every prior checkpoint into `Decision` drafts. It detects nothing itself — this is the same discipline `operationalRecommendationEngine.ts` (Step 15.5) established, one layer higher: a pure translation from "here's a finding" to "here's an actionable executive item."

## What it aggregates (Step 1's own list) and how

| Named input | Where it actually comes from |
|---|---|
| Business Health | `evaluateBusinessHealthAction()` (Step 15.5) — readiness scores' `suggestedNextSteps` |
| Operational Objectives | `evaluateObjectivesAction()` (Step 15.6) — each objective's `ObjectiveHealth.recommendations` |
| Knowledge Health | `computeKnowledgeHealth()` (Step 12) — broken/duplicate/circular relationship findings |
| Relationship Constraints | Folded into the `OperationalRecommendation[]` above via `recommendationsFromViolations` (Step 15.5) |
| Dependency/Impact Analysis | Not drafted directly this checkpoint — see Known Limitations |
| Workspace Health | Expired documents (`Document.expires_at`), fetched directly by `executiveDecisionsActions.ts` |
| Operational Recommendations | The direct input type — `OperationalRecommendation[]`, Step 15.5's own shape |
| Timeline Events | Recorded as an *output* of this layer (Step 9), not consumed as an input |
| Readiness Scores | The same readiness scores feeding Business Health's `suggestedNextSteps` |

## Draft generation

```ts
function generateDecisionDrafts(input: GenerateDecisionDraftsInput): CreateDecisionInput[]
```

Four sources, each producing one `CreateDecisionInput` per finding:

1. **`RecommendationSource[]`** — any `OperationalRecommendation[]` the caller supplies, tagged with a `generatedBy` engine name (`"business_health_engine"`, `"objective_health_engine"`, `"business_rule_engine"`) and optionally a `relatedObjectiveId`.
2. **`brokenRelationships`** (Step 12) — one Decision per broken edge.
3. **`duplicateRelationshipGroups`** / **`circularReferenceGroups`** (Step 12) — one Decision per group.
4. **`expiredDocuments`** — one Decision per expired `Document`, naming it in the title.

## Category mapping

Every `KnowledgeNodeType` maps to one of the 14 named `DecisionCategory` values via a lookup table (`client`/`lead`/`proposal` → CRM, `event` → Events, `contract` → Compliance, etc.); anything unmapped (workspace, inventory_item, purchase, …) falls back to `"operations"` — the same disclosed catch-all `businessHealthEngine.ts` uses. A `ruleId` naming an approval concept (`"...approval"`, `"...reviewed"`, `"...signed"`) always routes to `"approvals"` regardless of its node's own category.

## Priority at draft time

Every draft's priority is computed via `priorityEngine.computePriority` with `ageDays: 0` — a brand-new issue starts at whatever priority its inherent severity/impact gives it. `executiveDecisionsActions.ts` re-scores every *persisted, still-open* Decision on each subsequent evaluation using its real elapsed age, so priority genuinely rises over time for an unresolved issue (see `docs/priority-engine.md`).

## Deduplication (`dedupe_key`)

Not a spec-named `Decision` field — a practical necessity: re-running the evaluation must never spawn a second Decision for the same underlying issue. `dedupe_key = ${generatedBy}:${ruleId}:${nodeType}:${nodeId}`, checked by `decisionsStore.upsertDecision` against every still-open Decision before creating a new row. Once a Decision is `resolved` or `archived`, its `dedupe_key` becomes available again — if the same issue reappears, a fresh Decision is created rather than silently reusing the old, closed one.

## Known limitations (disclosed, not hidden)

- **Dependency/Impact Analysis (Step 10.8) isn't drafted into Decisions directly.** The Knowledge Health findings that reuse it (broken/circular relationships) are; a standalone "this asset has N downstream dependents" Decision type doesn't exist yet.
- **Business Rule Violations on readiness-swept node types (proposal/event/client/vendor) are never double-drafted.** `executiveDecisionsActions.ts` filters `businessRuleViolations` to exclude those four node types before feeding them through `recommendationsFromViolations`, since Business Health's own readiness sweep already surfaces those violations as `suggestedNextSteps`.
- **"Archive Duplicate Assets" (one of the spec's own Step 4 examples) is honestly "Resolve duplicate relationship group.**" There is no asset-level duplicate-file detector anywhere in this codebase — `knowledgeHealthEngine.findDuplicateRelationships` (Step 12) finds duplicate *relationships*, which is the real, already-computed signal reused here.
