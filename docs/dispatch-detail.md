# Dispatch Detail

`src/modules/dispatch/components/DispatchDetailView.tsx` — v2.0 Checkpoint 28, Step 13.

## What it shows

One order's full picture: its assignments (each with `resource_type`/`resource_id`, current `queue_state`, latest `reason`, and its own attempt count), and — on demand — its validation, health scores, and explanation.

## `evaluateDispatchOrderAction` is wired directly — the one deliberate exception

The same pattern `ExecutionPackageDetailView.tsx`'s `evaluateExecutionPackageAction` establishes: every other Detail view in this codebase is read-only plus one "Evaluate" button, and this one follows suit. `evaluateDispatchOrderAction` is a genuine re-derivation of already-computed data (resolves live resource status, re-runs `DispatchValidationEngine`/`DispatchHealthEngine`/`DispatchExplanationEngine`) — never a mutation, so wiring it directly into the view doesn't violate the "no create/mutate control wired" scope every other action in this file still carries.

## Accept/Decline/Cancel exist and are fully tested, but no button calls them yet

`acceptDispatchAssignmentAction`, `declineDispatchAssignmentAction`, `cancelDispatchOrderAction`, and the rest of `dispatchActions.ts`'s mutation surface are built, tested, and ready — but `DispatchDetailView` doesn't wire a click handler to any of them. The same disclosed "no create/mutate control wired yet" scope every prior platform's Detail view in this codebase carries (`AllocationRequestDetailView.tsx`, `RequirementDetailView.tsx`, and others follow the identical pattern — an `onClick={() => onEvaluate(...)}` for the read, nothing for the writes).

## Order identity — no title, so a short id is shown instead

Unlike an `ExecutionPackage` (which carries `metadata.title`), a `DispatchOrder` has no display name of its own — it's reserved vocabulary in the Knowledge Graph, matching its own lack of node identity. The view renders `Order #${order.id.slice(-8)}` — the last 8 characters of the generated id, stable and readable without inventing a name field the domain type doesn't have.
