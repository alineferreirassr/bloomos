# Operational Objectives Layer

v2.0 Checkpoint 25, Step 15.6. The Operational Intelligence Platform (Step 15.5) gains a goal layer: deterministic Objectives, scored continuously against already-computed operational state. No AI, no predictions — every number here is either a direct count/percentage over real data, or a disclosed heuristic constant with a comment explaining why.

## Architecture

```
Objective Registry (mock store) ──► ObjectiveEngine (dependencies, status transitions, effective status)
        │                                    │
        ▼                                    ▼
ProgressEngine (per-requirement scoring) ──► ObjectiveHealthEngine (on_track/at_risk/off_track/blocked)
        │                                    │
        └──────────► ScorecardEngine ◄───────┘
                            │
                   objectivesActions.ts (the only real caller)
                            │
                   ObjectivesSection.tsx (extends BusinessHealthDashboardView)
```

| Module | Responsibility | Reuses |
|---|---|---|
| `lib/data/mock/objectivesStore.ts` | CRUD persistence for `Objective` records | Same `let`-array/`resetXStore()` convention as `knowledgeGraphStore.ts`/`businessHealthSnapshotsStore.ts` |
| `core/objectives/progressEngine.ts` | Completion %, missing requirements, remaining tasks per objective | `relationshipConstraintsEngine.edgeCountsForRule` (now exported) for graph-shaped requirements; never re-derives relationship counting |
| `core/objectives/objectiveEngine.ts` | Dependency satisfaction, status-transition validity, effective status (adds "overdue" without storing it) | The `existingNodeKeys` convention `knowledgeHealthEngine`/`orphanDetectionEngine` established, and `businessRuleEngine`'s violations |
| `core/objectives/objectiveHealthEngine.ts` | Classifies each objective's health state | `operationalRecommendationEngine.recommendationsFromMissingRequirements` (Step 15.5) directly |
| `core/objectives/objectiveTimelineEngine.ts` | Maps a status transition to one of the 7 named Timeline events | Nothing to detect — pure mapping |
| `core/objectives/scorecardEngine.ts` | Workspace-wide scorecard | `businessReadiness` is `BusinessHealthReport.overallScore` (Step 15.5) passed straight through, never recomputed |
| `modules/objectives/objectivesActions.ts` | The one real orchestrator | Calls `evaluateBusinessHealthAction()` (Step 15.5) directly for `businessReadiness` — genuine reuse of the whole prior orchestrator |

## Objective model

```ts
interface Objective {
  scope: "workspace" | "department" | "client" | "event" | "project" | "collection" | "asset" | "custom";
  node: KnowledgeNodeRef | null;   // null for department/project/custom — see below
  status: "not_started" | "in_progress" | "completed" | "blocked" | "archived";  // 5 stored values
  requirements: ObjectiveRequirement[];  // 10 named types, discriminated union
  dependencies: ObjectiveDependency[];   // 8 named kinds
  due_date: string | null;
}
```

**"Overdue" is never stored.** It's the 6th status the spec names, derived fresh from `due_date` by `objectiveEngine.deriveEffectiveStatus` every time it's needed — storing it would let it go stale the instant the clock passes `due_date` without a write, the same "definition vs. computed" split this checkpoint uses everywhere else (a `HealthCategoryScore` is computed fresh, never cached as data).

**`department` and `project` have no `KnowledgeNodeType`.** BloomOS has no Department or Project entity anywhere in the codebase. Rather than fabricate one, objectives with these scopes (and `custom`) always have `node: null`, are identified by their own `id`, and Timeline events for them are recorded against the `"workspace"` EntityType. Their requirements still evaluate normally against whatever `counterpartNodeType` each requirement names.

## The 10 requirement types

Four (`required_assets`, `required_documents`, `required_deliverables`, `required_relationships`) share one shape and reuse `relationshipConstraintsEngine.edgeCountsForRule` — "deliverable" has no dedicated flag anywhere in the data model; it's the identical relationship-edge count as an Asset/Document requirement, just labeled for what the objective author means by it, not a fabricated new concept.

The other six each reuse one real system:

| Type | Reuses |
|---|---|
| `required_approvals` | A caller-resolved `approvalFlags` bag — only 3 named keys are wired up this checkpoint (`proposal_reviewed` from `ProposalDraft.reviewed_at`, `contract_signed` from `Contract.signature_status`, `media_asset_approved` from `MediaAsset.status`); any other key an objective author names is a disclosed, honest `false`, never a guess |
| `required_metadata` | `MediaAsset.metadata` (Step 4, Metadata Engine) |
| `required_tags` | `MediaAsset.tags` (Step 5, Tagging System) |
| `required_timeline_activity` | `TimelineActivity` rows already recorded (the audit trail every other engine this checkpoint uses) |
| `required_communication` | Real `Comment` rows via Checkpoint 24's Comments System (`core/comments`) |
| `required_business_rules` | `businessRuleEngine.ts` (Step 15.5) |

`progressEngine.ts` never fetches any of this itself — every requirement is evaluated against an already-resolved `RequirementContext`, exactly like `readinessEngine.ts` takes a pre-computed `CompletenessResult` instead of raw entities.

## Dependencies vs. requirements

Requirements define what "complete" means; dependencies gate whether an objective is *allowed* to reach `completed`, even at 100% requirement completion. `validateStatusTransition` only gates the `completed` transition — every other transition (start, block, reopen, archive) is always allowed, since only claiming "done" is a false statement if something is actually unmet.

`objectivesActions.ts` builds a genuinely accurate `existingNodeKeys` set — every real Client/Event/Contract/Proposal/Invoice/Asset/Folder/Collection id the workspace has — deliberately more complete than `businessHealthActions.ts`'s own narrower set (which only tracks Media Asset *owner* references, sufficient for that file's orphan-detection purpose but not for a Client/Event existence check).

## Objective Health

`on_track` / `at_risk` / `off_track` / `blocked` — a pure categorization over `ProgressEngine`'s completion % and `ObjectiveEngine`'s dependency evaluation, using two disclosed heuristic thresholds (70% = on track, 30% = at risk, same pattern as `workspaceHealthEngine.ts`'s `OVERDUE_APPROVAL_THRESHOLD_DAYS`). Blocked and overdue both override the percentage-based classification, since a dependency you can't control or a missed date matters more than how far along the rest of the work is.

## Scorecard

Two intentionally distinct completion metrics: **Average Completion** is the mean of every objective's own `completionPercent` (a continuous "how far along" snapshot); **Operational Progress** is the *rate* of objectives that have actually finished, by count. A workspace can have 90% average completion across four objectives with only one of them actually done — Operational Progress (25%) surfaces that; Average Completion (93%) alone would hide it. **Overall Operational Score** is a disclosed even blend of Average Completion and Business Readiness (Step 15.5's `overallScore`) — an average of two already-computed numbers, not a prediction.

## Timeline Integration

7 new `TimelineActivityType` values (`objective_created/started/updated/completed/blocked/reopened/archived`), deliberately distinct from Step 15.5's `operational_*` events: those fire from a periodic evaluation diffing against a prior snapshot; these fire the instant an explicit status transition happens, via `objectiveTimelineEngine.objectiveTimelineEventForTransition`.

## Known limitations (disclosed, not hidden)

1. **Objective Completion Trend is not implemented.** This checkpoint stores only the latest scorecard evaluation (`businessHealthSnapshotsStore.ts`), not a time series — the dashboard's Objective Completion Trend card says so directly rather than fabricating chart data.
2. **`required_approvals` only resolves 3 named concepts** (proposal review, contract signature, media asset approval) — any other `approvalKey` an objective author invents always evaluates to unmet, disclosed in both the type's doc comment and this file.
3. **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead via `tsc --noEmit`, `eslint` (0 errors), the full `vitest` suite (5874 tests), and a successful production build.

## Where it's used

- `modules/objectives/objectivesActions.ts` — `createObjectiveAction`, `listObjectivesAction`, `updateObjectiveStatusAction`, `evaluateObjectivesAction`.
- `modules/objectives/components/ObjectivesSection.tsx` — extends `/assets/business-health`'s `BusinessHealthDashboardView` with Objectives Overview, Progress Indicators, Blocked Objectives, and Upcoming Objectives.

## Tests

- `lib/data/mock/objectivesStore.test.ts` (6), `core/objectives/progressEngine.test.ts` (9), `objectiveEngine.test.ts` (12), `objectiveHealthEngine.test.ts` (6), `objectiveTimelineEngine.test.ts` (7), `scorecardEngine.test.ts` (6) — every pure engine, unit-tested in isolation.
- `modules/objectives/objectivesActions.test.ts` (10) — integration-level: the full fetch-and-compute chain against the real seeded mock workspace, including a blocked-completion test and a repeat-evaluation stability test.
- `modules/objectives/components/ObjectivesSection.test.tsx` (5) — render, blocked list, upcoming list, error state, empty state.
