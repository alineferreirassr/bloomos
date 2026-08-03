# Execution Timeline Engine / Knowledge Graph Integration / Executive Integration

`src/core/fieldOperations/{executionTimelineEngine,fieldOperationRiskEngine,fieldOperationFindingsEngine}.ts` — v2.0 Checkpoint 29, Steps 9-11.

## Execution Timeline Engine — the spec's 7 named events

```ts
executionStartedEvent(): ExecutionTimelineEvent
executionPausedEvent(reason: string | null): ExecutionTimelineEvent
executionResumedEvent(): ExecutionTimelineEvent
executionCompletedEvent(): ExecutionTimelineEvent
executionCancelledEvent(reason: string): ExecutionTimelineEvent
executionFailedEvent(reason: string): ExecutionTimelineEvent
executionArchivedEvent(): ExecutionTimelineEvent
```

Each is a pure builder — `{ type, description }` — mirroring `dispatchTimelineEngine.ts`'s shape exactly. `fieldOperationsActions.ts` calls one of these only on a real transition, never on every read/re-evaluation — the same "avoid Timeline noise" discipline every prior checkpoint's Timeline integration follows. No event is emitted on `buildFieldOperationAction` (build/creation) — the 7 named events begin only at "Execution Started," a deliberate, disclosed scope difference from Dispatch (which emits an event on order creation).

### The disclosed Timeline gap — `aborted` shares `execution_failed`

The spec names exactly 7 Timeline events but the domain has 10 lifecycle states, including `aborted` — which has no dedicated event of its own. `abortSessionAction` emits the same `executionFailedEvent(reason)` that `failSessionAction` does. The two stay fully distinct in domain data — `ExecutionSession.outcome` is `"aborted"` vs `"failed"` — only the shared Timeline entry type looks the same, disclosed here rather than silently glossed over.

## Knowledge Graph Integration — 0 live, 6 reserved

```ts
"field_operation", "execution_session", "execution_attempt", "current_phase", "completed_step", "execution_result"
```

Registered in `types/knowledgeGraph.ts`'s `RELATIONSHIP_TYPES`/`RELATIONSHIP_TYPE_LABELS`, alongside every other checkpoint's own reserved vocabulary — the single existing `RelationshipType` system, never a second graph. All 6 are reserved, none are emitted this checkpoint — an even more conservative ratio than Execution Package's own 0-live/8-reserved.

**Why zero live edges.** Field Operations "tracks operational state only" (the spec's own Step 8 line) and introduces no new resource references beyond what Dispatch's own `assigned_worker`/`assigned_vehicle`/`assigned_equipment` edges already established. `current_phase`/`completed_step` name plan-internal data (`ExecutionPhase`/`ExecutionStep`) that never had node identity even in Operational Planning's own domain — there is nothing new here to point a graph edge at.

## Executive Integration — 7 named findings

```ts
detectFieldOperationRisks(inputs: FieldOperationRiskInput[]): FieldOperationFinding[]
```

| Finding | Severity | Condition |
|---|---|---|
| `execution_blocked` | high | `validation.valid === false` |
| `execution_paused` | medium | `session.lifecycle_state === "paused"` |
| `execution_failed` | high | `session.outcome === "failed"` (description includes the reason) |
| `execution_healthy` | low | valid + `overallOperationalHealth >= 80` |
| `execution_completed` | low | `session.outcome === "completed"` |
| `execution_delayed` | medium | `pauseHealth < 60` — this session's own pace, never a cross-session comparison |
| `operational_delay` | medium | actual `executionDurationSeconds` exceeds the frozen plan's summed `estimated_duration_minutes * 60` by more than 1.5× — the overrun ratio, resolved by the caller (`sumEstimatedDurationSeconds`), never re-derived inside the risk engine |

```ts
fieldOperationFindingsToRecommendations(findings, operations, workspaceId): OperationalRecommendation[]
```

Mirrors `dispatchFindingsEngine.ts` exactly: severity map `high → critical` / `medium → warning` / `low → info`, `ruleId` prefixed `"field_operations.${finding.type}"`, node resolution falls back to the operation's own `context` then the workspace. Wired into `executiveDecisionsActions.ts`'s `recommendationSources` array (`generatedBy: "field_operations_engine"`) — additive, confirmed by the full pre-existing Executive Decisions test suite (13/13) still passing unchanged.
