# Dispatch Queue Engine / Acceptance Engine

`src/core/dispatch/{dispatchQueueEngine,acceptanceEngine}.ts` — v2.0 Checkpoint 28, Steps 5-6.

## Dispatch Queue Engine — pure reads and transition rules

- **`isTerminalQueueState(state)`** — `true` for `accepted`/`declined`/`cancelled`/`expired`/`completed_placeholder`.
- **`countByQueueState(assignments)`** — a count per named state, including zero-count states (never a sparse map).
- **`findAssignmentsInState(assignments, state)`** — filters to one state.
- **`isPastDeadline(assignment, now)`** — `false` for a terminal assignment (regardless of `expires_at`) and `false` when no deadline is set; otherwise a plain timestamp comparison. A disclosed check only — it never auto-transitions anything; the caller decides whether/when to act on a past-due assignment.
- **`isLegalQueueTransition(from, to)`** — the one state machine every mutation in this checkpoint goes through, backed by a disclosed `LEGAL_TRANSITIONS` map:

```ts
{
  queued: ["assigned", "cancelled"],
  assigned: ["pending", "cancelled"],
  pending: ["accepted", "declined", "expired", "cancelled"],
  accepted: [], declined: [], cancelled: [], expired: [], completed_placeholder: [],
}
```

Nothing is legal out of a terminal state — an accepted/declined/cancelled/expired assignment stays that way; reassignment (a fresh attempt against a different resource) is the spec's own disclosed "Reassignment Placeholder," never a queue-state transition.

## Acceptance Engine — Accept/Decline/Timeout, validated against the same state machine

```ts
evaluateAcceptDecision(assignment): AcceptanceDecisionResult
evaluateDeclineDecision(assignment, reason): AcceptanceDecisionResult
evaluateTimeoutDecision(assignment, now): AcceptanceDecisionResult
```

Each named decision resolves to `evaluateTransition(assignment, nextState)` internally — checked against `isLegalQueueTransition`, never a second, duplicate state machine. `evaluateDeclineDecision` additionally requires a non-blank `reason` (the spec's own "Reason" line — never a bare boolean with no explanation). `evaluateTimeoutDecision` additionally requires `isPastDeadline(assignment, now)` — a timeout can't fire before its own deadline.

## `evaluateReassignmentPlaceholder()` — an honest, disclosed no-op

```ts
export function evaluateReassignmentPlaceholder(): { supported: false; reason: string } {
  return { supported: false, reason: "Reassignment is not implemented in this checkpoint — reserved for a future Dispatch enhancement." };
}
```

No code path in this checkpoint creates a fresh attempt for a declined/expired assignment against a different resource — reassignment would mean re-selecting a candidate, which is Resource Allocation's job, not Dispatch's.

## "No notifications" — the spec's own Step 6 line

This file — and this checkpoint — never calls into the Communication Platform. A decision is recorded (via `dispatchOrdersStore.transitionAssignment`, appending a `DispatchAttempt`), nothing is sent.

## Module-layer wiring — 4 exported actions cover the full lifecycle

`modules/dispatch/dispatchActions.ts` exposes `assignDispatchAssignmentAction`/`presentDispatchAssignmentAction` (plain queue advances, `queued → assigned → pending`, validated the same way as `cancelled` via `isLegalQueueTransition` directly — no Accept/Decline semantics apply to them) alongside `acceptDispatchAssignmentAction`/`declineDispatchAssignmentAction`/`timeoutDispatchAssignmentAction` (the Acceptance Engine's three named decisions). All five route through one private `respondToAssignment` helper, so the attempt log, Timeline recording, and legal-transition check can never drift apart between them.
