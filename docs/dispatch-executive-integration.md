# Dispatch Risk Engine / Findings Engine — Executive Integration

`src/core/dispatch/{dispatchRiskEngine,dispatchFindingsEngine}.ts` — v2.0 Checkpoint 28, Step 11.

## Dispatch Risk Engine — 6 named detectors

```ts
detectDispatchRisks(results: DispatchOrderResult[]): DispatchFinding[]
```

| Finding | Trigger | Severity |
|---|---|---|
| `dispatch_blocked` | `validation.valid === false` | high |
| `dispatch_ready` | `validation.valid === true && health.dispatchReadiness === 100` | low |
| `low_acceptance_rate` | `health.acceptanceRate < 60` | medium |
| `queue_congestion` | `health.queueHealth < 60` | medium |
| `assignment_failure` | an assignment's `queue_state === "expired"` | high |
| `resource_rejected` | an assignment's `queue_state === "declined"` (includes the reason, when one was given) | medium |

Every detector reads a `DispatchOrderResult` the caller (`dispatchActions.ts`'s `evaluateDispatchPlatformHealthAction`) already assembled from `DispatchValidationEngine`/`DispatchHealthEngine` — this file detects nothing new, it only classifies already-computed results. `assignment_failure`/`resource_rejected` can fire multiple times per order (once per matching assignment); the other four fire at most once per order.

## Dispatch Findings Engine — translation, never re-detection

```ts
dispatchFindingsToRecommendations(findings: DispatchFinding[], orders: DispatchOrder[], workspaceId: string): OperationalRecommendation[]
```

Translates `DispatchFinding[]` into the Executive Decision Platform's existing `OperationalRecommendation` shape — the same "translate, don't duplicate" discipline `executionPackageFindingsEngine.ts`/`allocationFindingsEngine.ts`/`schedulingFindingsEngine.ts`/`capabilityFindingsEngine.ts` established. `SEVERITY_MAP` folds the 3 named severities into Executive Decisions' own 3-level scale: `high → critical`, `medium → warning`, `low → info`. `ruleId` is always `"dispatch.${finding.type}"`.

`resolveFindingNode` falls back to the workspace node whenever the related order can't be found or `relatedOrderId` is `null` — since a `DispatchOrder` has no context node of its own (see [`dispatch-timeline-and-knowledge-graph.md`](dispatch-timeline-and-knowledge-graph.md)), it resolves to that order's own `workspace_id`, never a fabricated node.

## Wiring into `executiveDecisionsActions.ts`

```ts
export async function dispatchRecommendationsForExecutiveDecisions() { ... }
```

An adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateDispatchPlatformHealthAction`'s findings. Wired into `recommendationSources` as `{ generatedBy: "dispatch_engine", recommendations: dispatchRecommendations }`, additive alongside every prior checkpoint's own contributor — confirmed by the full pre-existing Executive Decisions test suite still passing unchanged (this is the exact wiring step Checkpoint 27.3 forgot on its first pass, caught only while drafting that checkpoint's final report; this checkpoint's own task list carried an explicit self-reminder not to repeat it).

Reaching the spec's other two named feed targets (Business Health, Operational Intelligence) happens transitively through Executive Decisions — the same scope every prior checkpoint's own Executive Integration disclosed; this checkpoint doesn't touch `core/knowledge/businessHealthEngine.ts`'s own input signature either.
