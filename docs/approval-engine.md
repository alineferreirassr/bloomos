# Approval Engine

`src/core/operationalPlanning/approvalEngine.ts` — v2.0 Checkpoint 27.2, Step 10.

## Requirements only — no workflow automation

An `ApprovalRequirement` tracks *who/what must approve* a plan/phase/step/milestone before it can proceed — one of the spec's 5 named types (`manager`/`client`/`quality`/`supervisor`/`automatic_rule_placeholder`), through `pending`/`approved`/`rejected`. This file never automates or grants an approval itself. `automatic_rule_placeholder` is a real, storable `ApprovalType` value with **no automation behind it** — a disclosed placeholder for a future rule engine (Automation Platform integration), not a live automatic-approval path. The Stop Condition is explicit: "Do NOT automate approvals."

## `pendingApprovals` / `rejectedApprovals`

Simple filters by `status`.

## `approvalCompletionRatio`

```ts
approvalCompletionRatio(approvals): number  // vacuous 1 for zero requirements
```

## `hasApprovalBottleneck`

```ts
hasApprovalBottleneck(approvals, thresholdCount = 3): boolean
```

A simple, disclosed threshold — `thresholdCount` or more pending approvals at once is surfaced as a bottleneck. Never a queueing/SLA analysis.

## Where approval decisions actually happen

`decideApprovalAction(planId, approvalId, decision)` (`operationalPlanningActions.ts`) — the only path that sets `status: "approved" | "rejected"`, stamping `approved_by`/`approved_at` on approval, clearing both on rejection. `approvePlanAction` (whole-plan approval) additionally **blocks** on any pending approval requirement (`pendingApprovals(plan.approvals).length > 0`) or a blocking validation error — a plan cannot become `"approved"` while an approval requirement is still open.

## Consumers

- `operationalConstraintsEngine.ts` — any pending approval becomes a `required_approvals` warning (never a blocking error at the constraints layer — that block lives specifically in `approvePlanAction`).
- `operationalHealthEngine.ts` — `computeApprovalCoverageScore` = `100 × approvalCompletionRatio(...)`.
- `operationalRiskEngine.ts` — `hasApprovalBottleneck` feeds the `approval_bottleneck` finding.
