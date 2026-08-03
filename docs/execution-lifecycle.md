# Execution Lifecycle

`src/types/fieldOperations.ts`, `src/core/fieldOperations/{fieldOperationEngine,executionSessionEngine}.ts` — v2.0 Checkpoint 29, Steps 2-3.

## The 10 named states — real precedence, not spec-array order

```ts
export const EXECUTION_LIFECYCLE_STATES = ["created", "waiting", "started", "paused", "resumed", "completed", "cancelled", "aborted", "failed", "archived"] as const;
```

The spec lists these 10 names without an order. The real precedence, encoded in `LEGAL_TRANSITIONS`:

```
created → waiting → started → paused ⇄ resumed → { completed | cancelled | aborted | failed } → archived
```

| From | Legal next states |
|---|---|
| `created` | `waiting`, `started`, `cancelled` |
| `waiting` | `started`, `cancelled` |
| `started` | `paused`, `completed`, `cancelled`, `aborted`, `failed` |
| `paused` | `resumed`, `cancelled`, `aborted`, `failed` |
| `resumed` | `paused`, `completed`, `cancelled`, `aborted`, `failed` |
| `completed` / `cancelled` / `aborted` / `failed` | `archived` |
| `archived` | *(none)* |

- **`cancelled`** is reachable from any non-terminal, pre-completion state — a deliberate stop.
- **`aborted`/`failed`** are reachable only from an active state (`started`/`paused`/`resumed`) — a session that never started has nothing to abort or fail.
- **`archived`** is reachable from any outcome-bearing terminal state. Nothing is legal out of `archived` — a fresh `ExecutionSession` (via `startNewSession`/`restartFieldOperationAction`) is how work resumes after a terminal outcome, never a transition out of one.

```ts
export function isLegalLifecycleTransition(from: ExecutionLifecycleState, to: ExecutionLifecycleState): boolean
```

The single state machine every mutation action in this checkpoint is checked against — never a second, duplicate one.

## Field Operation Engine — the one build-time eligibility gate

```ts
evaluateFieldOperationEligibility(input: { assignmentQueueState: string; packageStatus: string }): { canBuild: boolean; reason: string | null }
```

A small, cheap check run once before a `FieldOperation` is ever created — distinct from `ExecutionValidationEngine`'s fuller 6-check gate (Step 4) that re-runs on every Start/Resume attempt thereafter. Requires `assignmentQueueState === "accepted"` and `packageStatus === "approved"`. Dispatch (28) already decided whether an assignment is accepted; this never recalculates that decision, only reads it.

## Deterministic by construction

Every transition — legal or not — is a pure lookup against `LEGAL_TRANSITIONS`, never a runtime decision that could vary between calls with the same input. "Lifecycle transitions must be deterministic" (the spec's own Step 2 line) holds because there is exactly one function any caller can reach a transition through.
