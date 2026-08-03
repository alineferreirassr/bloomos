# Executive Reports

v2.0 Checkpoint 25.7, Step 12. `core/executiveDecisions/executiveReportEngine.ts` generates every named section as a plain template over already-computed `Decision[]`, `WorkspaceExecutiveScorecard` (Step 11), and `ExecutiveInsights` (Step 13) — zero new data access, zero new detection.

```ts
interface ExecutiveReport {
  executiveSummary: string;
  criticalIssues: string[];
  businessRisks: string[];
  operationalRisks: string[];
  decisionQueueSummary: string;
  completedDecisionsSummary: string;
  blockedDecisionsSummary: string;
  topImprovements: string[];
  evaluatedAt: string;
}
```

## Section-by-section

- **`executiveSummary`** — one sentence combining `scorecard.overallExecutiveScore`, the queue length, critical count, resolved count, and blocked count.
- **`criticalIssues`** — every `"critical"`-priority Decision title in the queue.
- **`businessRisks`** / **`operationalRisks`** — the queue split by category: `compliance`/`security`/`finance` at `"high"` priority or above go to Business Risks; everything else at `"high"`+ goes to Operational Risks. This is the one place in this checkpoint that draws a business/operational line, and it's a simple category-set membership check, not a new classification engine.
- **`decisionQueueSummary`** / **`completedDecisionsSummary`** / **`blockedDecisionsSummary`** — one honest sentence each, including the "empty" / "none yet" case explicitly rather than an empty string.
- **`topImprovements`** — the queue's own top 5 titles, plus up to two insight-derived suggestions naming the most-affected client/event (`ExecutiveInsights.mostImpactedClients[0]` / `mostOverloadedEvents[0]`) — the same `ExecutiveInsights` data (Step 13) restated as an action, never a new recommendation mechanism.

## Blocked Decisions are supplied, not derived here

`ExecutiveReportInput.blockedDecisions` is a caller-supplied list, not something `executiveReportEngine.ts` computes itself — `executiveDecisionsActions.ts` already ran `decisionEngine.evaluateDecisionDependencies` per Decision during scoring, and passes through exactly the ones with at least one unmet dependency. Re-deriving "blocked" from `Decision.status` alone wouldn't be accurate, since `DecisionStatus` has no `"blocked"` value (see `docs/executive-decision-engine.md` and `types/executiveDecisions.ts`'s own doc comment on why "overdue"/"blocked"-as-status was deliberately not added to the 5 stored values).

## Where it's used

Computed once per `evaluateExecutiveDecisionsAction()` call and returned as `EvaluateExecutiveDecisionsResult.report`. `ExecutiveDashboardView.tsx` currently surfaces `topImprovements` (as "Top Opportunities"); the rest of the report is available in the action's return value for a future dedicated report view or export, not yet built into the UI this checkpoint.
