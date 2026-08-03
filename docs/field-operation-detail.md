# Field Operation Detail

`src/modules/fieldOperations/components/FieldOperationDetailView.tsx`, route `/field-operations/[id]` — v2.0 Checkpoint 29, Step 13.

## What it shows

One operation's full picture, sourced from its current session (`operation.sessions[operation.sessions.length - 1]`):

- **KPIs**: Current Phase, Completed Steps, Completed Milestones, Transitions (attempt count).
- **Evaluation** (on demand): all 6 named health scores, elapsed/pause/execution/completion durations, the explanation summary and health summary, every non-empty "why" list (cannot-start / paused / failed / completion-rejected), and any validation errors.
- **Operational Progress** (on demand): remaining steps, pending milestones, checklist progress %, deliverable progress %.
- **Timeline**: the current session's own `attempts: ExecutionAttempt[]`, newest first — each showing its lifecycle state, reason (if any), and timestamp.

## `evaluateFieldOperationAction` is wired directly — the one deliberate exception

The same pattern `DispatchDetailView.tsx`'s `evaluateDispatchOrderAction` establishes: every other Detail view in this codebase is read-only plus one "Evaluate" button, and this one follows suit. `evaluateFieldOperationAction` is a genuine re-derivation of already-computed data (resolves the real Dispatch/Package/frozen-snapshot state, re-runs `ExecutionValidationEngine`/`ExecutionStateEngine`/`OperationalProgressEngine`/`ExecutionHealthEngine`/`ExecutionExplanationEngine`) — never a mutation.

## Session lifecycle actions exist and are fully tested, but no button calls them yet

`startSessionAction`, `pauseSessionAction`, `resumeSessionAction`, `completeSessionAction`, `cancelSessionAction`, `abortSessionAction`, `failSessionAction`, `archiveSessionAction`, and `restartFieldOperationAction` are built, tested, and ready — but `FieldOperationDetailView` doesn't wire a click handler to any of them. The same disclosed "no create/mutate control wired yet" scope every prior platform's Detail view in this codebase carries.

## "Timeline" here means the session's own attempt log, not the global Timeline feed

The spec's Step 13 names "Timeline" as one of the Detail view's required sections. Rather than duplicating the workspace-wide Timeline feed those 7 named events (`execution_started`, etc.) are already recorded into via `recordTimelineActivity`, this view renders the exact transition log those events are emitted from — `ExecutionSession.attempts`. Every entry the view shows corresponds 1:1 to a real lifecycle transition; nothing is re-fetched from a second source.

## No display name — the same short-id convention `DispatchDetailView` uses

A `FieldOperation` has no `title`/`name` field of its own — it's reserved vocabulary in the Knowledge Graph, matching its own lack of node identity. The view renders `Field Operation #${operation.id.slice(-8)}`, the same stable, readable short-id pattern `Order #${order.id.slice(-8)}` established.
