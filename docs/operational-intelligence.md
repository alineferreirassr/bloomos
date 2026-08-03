# Operational Intelligence Layer

v2.0 Checkpoint 25, Step 15.5. The Enterprise Knowledge Graph evolves from a relationship map into an operational intelligence platform: eight new `core/knowledge/` engines convert already-computed graph/constraint/health data into business-facing scores, readiness reports, and recommendations. Every engine here is a pure composition over an engine that already existed before this step — the stop condition ("Do NOT duplicate Health logic that already exists. Do NOT create a second validation engine.") is enforced by never re-declaring a check that `relationshipConstraintsEngine`, `knowledgeHealthEngine`, or `orphanDetectionEngine` already performs.

## Architecture

```
CompletenessEngine ──┐
BusinessRuleEngine ───┼──► WorkspaceHealthEngine ──► BusinessHealthEngine ──► businessHealthActions.ts
KnowledgeHealthEngine ┘         (Step 12, reused)          (orchestrator)      (the only real caller)
                                                                  │
ReadinessEngine ◄─────────────────────────────────────────────────┘
       │
OperationalRecommendationEngine
       │
OperationalTimelineEngine ──► businessHealthSnapshotsStore.ts (mock, prior-evaluation snapshots)
```

| Module | Responsibility | Reuses |
|---|---|---|
| `completenessEngine.ts` | Per-entity missing-requirement checks for Proposal/Event/Client/Vendor | Knowledge Graph relationships (Hero Image/Contract role edges) for graph-shaped requirements; direct fields for scalar ones (pricing, approval, contact info) |
| `businessRuleEngine.ts` | Translates violations into one `BusinessRuleViolation[]` shape | `relationshipConstraintsEngine.validateNodeConstraints` (Step 10.7) + `knowledgeHealthEngine.findCircularReferenceGroups` (Step 12); adds exactly one new check, `findInvalidParentFolders` |
| `operationalRecommendationEngine.ts` | Maps a missing requirement or violation to a human recommendation, always tagged with the rule that generated it | A lookup table over `CompletenessResult`/`BusinessRuleViolation`, not a detector |
| `readinessEngine.ts` | Per-node `ReadinessScore` (score, missing requirements, warnings, blocking issues, next steps) | `relationshipConstraintsEngine.validateNodeConstraints` for every node type uniformly + a caller-supplied `CompletenessResult` for the four types that have one |
| `workspaceHealthEngine.ts` | Workspace-wide counts (assets without owners, broken relationships, expired documents, incomplete proposals/events, overdue approvals, pending dependencies, …) | `knowledgeHealthEngine.computeKnowledgeHealth` for every relationship/constraint-shaped count; only scalar-field counts (`Document.expires_at`, `ProposalDraft.generated_at`, `MediaAssetStatus`) are new |
| `businessHealthEngine.ts` | The 11 named `HealthCategory` scores + one `overallScore` | Every engine above; scores nothing itself |
| `operationalTimelineEngine.ts` | Diffs a "before" snapshot against an "after" report into `OperationalTimelineEvent[]` | Nothing to detect — pure set/score comparison |
| `businessHealthSnapshotsStore.ts` (`lib/data/mock/`) | Mock-only persistence of the last evaluation's score/violations, so the diff engine has a "before" to compare against | Same `let`-array/`resetXStore()` convention as every other mock store |

## The 11 Health Categories

```ts
type HealthCategory =
  | "relationship_health" | "asset_health" | "documentation_health"
  | "proposal_completeness" | "client_completeness"
  | "event_readiness" | "vendor_readiness" | "workflow_readiness"
  | "communication_health" | "knowledge_health" | "dependency_health";
```

Each resolves to a `HealthCategoryScore { category, score: number | null, issues: string[], notApplicableReason: string | null }`. `score` is `null` exactly when there's no real signal to compute from — never a fabricated number:

- **`workflow_readiness`** — the Knowledge Graph has a `"workflow"` node type, but no constraint rule and no Completeness Engine evaluator target it yet.
- **`communication_health`** — Checkpoint 24's Communication Platform (threads/messages/comments/announcements) isn't wired into the Knowledge Graph this checkpoint; its own health belongs to that platform, not fabricated here from unrelated data.
- **`asset_health` / `documentation_health` / `relationship_health` / `knowledge_health` / `proposal_completeness` / `client_completeness` / `event_readiness` / `vendor_readiness`** — `null` only when the workspace genuinely has zero of that record type to evaluate (a ratio with a zero denominator), not as a permanent gap.

`dependency_health` is the one category with no "no data" path — it's a flat, weighted penalty over `WorkspaceHealthReport.missingRequiredRelationships`/`pendingDependencies` counts (10 and 5 points respectively, clamped to zero), so it always has a score even in an empty workspace.

## Readiness

`ReadinessScore` is computed identically for every node type via `relationshipConstraintsEngine.validateNodeConstraints` (hard violations become `blockingIssues`, soft ones become `warnings`), plus a caller-supplied `CompletenessResult` when one exists. The bulk evaluation in `businessHealthActions.ts` computes readiness for Proposal/Event/Client/Vendor — the four types `completenessEngine.ts` covers. Invoice/Workspace/Asset/Collection readiness is available on demand from `computeReadinessScore` directly (constraint-only, since no completeness evaluator exists for them yet) but isn't part of the bulk sweep, to avoid an O(assets) scan on every dashboard load.

## Operational Recommendations

Every `OperationalRecommendation` carries the exact `ruleId` that generated it — the spec's own requirement. Two sources feed the same shape:

- `BusinessRuleViolation[]` already carries a `ruleId` (from `relationshipConstraintsRegistry.ts` or one of `businessRuleEngine.ts`'s own two checks) — passed straight through.
- `CompletenessResult.missingRequirements` are plain strings (`"Missing Hero Image"`) — `operationalRecommendationEngine.ts` holds a lookup table mapping each known string to a stable `ruleId` (e.g. `proposal_completeness.hero_image`). An unrecognized string still gets a derived, stable id (`completeness.<slug>`) rather than being silently dropped — every recommendation traces to a rule, with no exceptions.

## Timeline Integration

`operationalTimelineEngine.ts` never detects anything — it diffs an already-computed "after" (`BusinessHealthReport`, `ReadinessScore`, `ConstraintViolation[]`, `BusinessRuleViolation[]`) against a "before" read from `businessHealthSnapshotsStore.ts`, and returns the `OperationalTimelineEvent[]` that changed:

| Event | Fires when |
|---|---|
| `operational_health_improved` / `_declined` | The workspace's `overallScore` differs from its last evaluation |
| `operational_workspace_warning` | `overallScore` newly crosses below 50 (a disclosed heuristic threshold, same pattern as `workspaceHealthEngine.ts`'s `OVERDUE_APPROVAL_THRESHOLD_DAYS`) — not re-fired every evaluation a persistently unhealthy workspace stays below it |
| `operational_readiness_increased` / `_decreased` | A given node's `ReadinessScore.overallScore` changes between evaluations |
| `operational_constraint_violated` / `_fixed` | A `ConstraintViolation` newly appears / disappears (keyed by rule id + node) |
| `operational_critical_dependency_detected` | A new `circular_dependency` `BusinessRuleViolation` appears — the one violation the spec's own example names as "critical" |

These are deliberately distinct enum values from Step 13's `knowledge_relationship_constraint_violated` (which fires synchronously when a user's mutation attempt is blocked) — different trigger surface, not a duplicate.

`businessHealthActions.ts`'s `evaluateBusinessHealthAction()` is the only real caller: it fetches every entity once, feeds every engine above, diffs against the workspace's stored snapshot, records the resulting Timeline events via the same `ENTITY_TYPE_SET` guard `knowledgeGraphActions.ts`'s `recordGraphTimelineEvent` already established (Step 13), and persists the new snapshot.

## Known limitations

- **`unusedTemplates` is always `0`** in `WorkspaceHealthReport` — same disclosed rationale as `knowledgeHealthEngine`'s own `unused_templates` `notApplicable` entry: "Template" here means the Document Intelligence Platform's `ComposedDocument` system, which has no usage-tracking field and is out of scope for the Knowledge Graph.
- **Overdue-approval and workspace-warning thresholds are heuristics**, not business rules read off any record (`ProposalDraft` has no due-date field; nothing in the codebase defines a numeric "unhealthy" cutoff). Both are named constants with a doc comment explaining why, not hidden magic numbers.
- **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead via `tsc --noEmit`, `eslint`, the full `vitest` suite (5813 tests), and a successful production build including the new `/assets/business-health` route.

## Where it's used

- `modules/knowledgeGraph/businessHealthActions.ts` — `evaluateBusinessHealthAction()`, the single orchestrator.
- `modules/knowledgeGraph/components/BusinessHealthDashboardView.tsx` (`/assets/business-health`) — overall score, all 11 categories, and worst-first readiness tables per entity type. Linked from the Knowledge Graph Explorer's header.

## Tests

- `core/knowledge/completenessEngine.test.ts` (10), `businessRuleEngine.test.ts` (6), `operationalRecommendationEngine.test.ts` (9), `readinessEngine.test.ts` (5), `workspaceHealthEngine.test.ts` (10), `businessHealthEngine.test.ts` (9), `operationalTimelineEngine.test.ts` (14) — every pure engine, unit-tested in isolation.
- `relationshipConstraintsEngine.test.ts`'s `event_at_most_one_primary_contract` block (2) — the one new registry rule this step added.
- `modules/knowledgeGraph/businessHealthActions.test.ts` (4) — integration-level: the full 25-function fetch-and-compute chain against the real seeded mock workspace, including a repeat-evaluation test proving the diff engine stays silent when nothing changed.
- `modules/knowledgeGraph/components/BusinessHealthDashboardView.test.tsx` (4) — render, category/readiness rendering, error state, and the Re-evaluate button.
