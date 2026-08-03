# Workspace Scorecard (Executive)

v2.0 Checkpoint 25.7, Step 11. `core/executiveDecisions/executiveScorecardEngine.ts` produces the 7 named scores — every one of them is either reused directly from an earlier checkpoint's own score, or a simple average/blend of numbers that already exist. Nothing here is a new health computation.

```ts
interface WorkspaceExecutiveScorecard {
  operationalScore: number;
  businessScore: number;
  decisionScore: number;
  readinessScore: number;
  knowledgeScore: number;
  objectiveScore: number;
  overallExecutiveScore: number;
  evaluatedAt: string;
}
```

## Where each score comes from

| Score | Source | Reused as-is? |
|---|---|---|
| `businessScore` | `BusinessHealthReport.overallScore` (Step 15.5) | Yes, direct |
| `objectiveScore` | `WorkspaceScorecard.overallOperationalScore` (Step 15.6) | Yes, direct |
| `operationalScore` | `WorkspaceScorecard.operationalProgress` (Step 15.6) | Yes, direct — reused under this scorecard's own name, not recomputed |
| `knowledgeScore` | The `knowledge_health` category's own score from `BusinessHealthReport.categories` (Step 15.5) | Yes, direct; falls back to 100 when that category is itself `notApplicable` |
| `readinessScore` | Every `ReadinessScore.overallScore` currently on record (Step 15.5) | Averaged; defaults to 100 with no data |
| `decisionScore` | `DecisionScores.decisionScore` (Step 6) for every currently open Decision | Averaged; defaults to 100 with no open decisions |
| `overallExecutiveScore` | The six scores above | A disclosed, even blend: `Math.round((business+objective+operational+readiness+knowledge+decision)/6)` |

The "no data = 100" convention (rather than 0, or `null`) is deliberate and consistent with every other scorecard this checkpoint's predecessors built (`objectivesActions.ts`'s `WorkspaceScorecard`, `businessHealthEngine.ts`'s category defaults): an empty, freshly-created workspace is healthy by default, not broken by default.

## Where it's used

Computed once per `evaluateExecutiveDecisionsAction()` call, fed directly into `executiveReportEngine.generateExecutiveReport` and rendered as the top KPI row of `ExecutiveDashboardView.tsx`.
