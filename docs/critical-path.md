# Critical Path Engine — and Plan Evaluation

`src/core/operationalPlanning/{criticalPathEngine,operationalConstraintsEngine,operationalHealthEngine,operationalExplanationEngine,operationalComparisonEngine}.ts` — v2.0 Checkpoint 27.2, Steps 11-15. `evaluateOperationalPlanAction` composes all five into one `OperationalPlanResult`; this doc covers them together the same way `allocation-scoring.md` bundles Validation/Score/Explanation/Comparison.

## Critical Path Engine — dependency analysis, never scheduling optimization

```ts
computeCriticalPath(phases): CriticalPathResult
// { criticalStepIds, blockingStepIds, parallelStepIds, optionalStepIds, estimatedCompletionMinutes }
```

A longest-path calculation over `estimated_duration_minutes` and each `StepDependency.dependency_class` — **no calendar, no resource contention, no travel time**. Callers **must** confirm `detectDependencyCycle` found no cycle first; this engine assumes an acyclic graph and never re-checks (the same "don't duplicate a validation another engine already owns" discipline every composed engine here follows — `operationalPlanningActions.ts`'s `analyzePlan` short-circuits to a zero-length result when a cycle exists, rather than calling this function at all).

- `criticalStepIds` — every step lying on at least one path achieving the overall `estimatedCompletionMinutes`, found by walking backward from each maximal endpoint along whichever upstream dependency contributed the longest chain.
- `blockingStepIds` — every step named by at least one `"blocking"`-class incoming dependency.
- `optionalStepIds` — every step whose *every* incoming reliance is `"optional"`-class (nothing critical or blocking rests on it).
- `parallelStepIds` — everything else: off the critical path, not purely optional.

## Operational Constraints Engine — the 9 named checks, Step 11

`validateOperationalConstraints(input): OperationalValidationResult` composes every engine this checkpoint built — `PhaseEngine`, `ExecutionStepEngine`, `MilestoneEngine`, `DeliverableEngine`, `EvidenceEngine`, `ApprovalEngine` — never re-derives their logic:

| Check | Rule | Severity |
|---|---|---|
| Broken/circular dependencies | `broken_dependencies` | error |
| Missing Milestones (orphaned) | `missing_milestones` | error |
| Missing Deliverables (orphaned) | `missing_deliverables` | error |
| Missing Evidence (orphaned) | `missing_evidence` | error |
| Invalid phase order | `invalid_phase_order` | warning |
| Required Approvals pending | `required_approvals` | warning |
| Missing Resources (no assigned type) | `missing_resources` | warning |
| Missing Capability (none specified) | `missing_capability` | warning |
| Missing Schedule | — | not checked here (see below) |

**Interpretation, disclosed**: "Missing Deliverables/Evidence/Milestones" is implemented as *orphaned-reference* detection (a Deliverable/EvidenceRequirement/Milestone pointing at a step/phase/milestone id that doesn't exist in the plan), not "zero declared" — a defensible reading of ambiguous spec wording, and directly testable.

**Missing Schedule is the one check this pure engine cannot answer** — it needs Checkpoint 27's real Scheduling data (is there a real, non-cancelled `Appointment` linked to this plan's own context?). `operationalPlanningActions.ts`'s `checkMissingSchedule` does that one check itself and appends the result as a non-blocking warning — the explicit, disclosed boundary between "pure engine" and "actions layer does the one cross-module read."

## Operational Health Engine — 8 named scores, Step 13

`computeOperationalHealthScores(input): OperationalHealthScores` — `planCompletenessScore`, `dependencyHealthScore`, `evidenceCoverageScore`, `checklistCoverageScore`, `approvalCoverageScore`, `deliverableCoverageScore`, `milestoneCoverageScore`, `overallOperationalHealth` (unweighted average of the other seven). Same "not applicable resolves to a vacuous pass" discipline every score engine in this codebase follows, **except** `dependencyHealthScore`, which is `0` — not vacuous — when a real dependency cycle exists, mirroring `AllocationScoreEngine.computeCapabilityFitScore`'s zero-candidate precedent.

## Operational Explanation Engine — Step 14

`explainOperationalPlan(validation, health, criticalPath, milestones, deliverables): OperationalExplanation` turns an already-validated, already-scored plan into readable prose (`summary`, `missingRequirements`, `dependencyFailures`, `approvalBlockers`, `evidenceGaps`, `incompleteMilestones`, `incompleteDeliverables`, `criticalPathSummary`) — never exposes a bare health number without the reasoning behind it.

## Operational Comparison Engine — Step 15

`computeExecutionComplexity(phases)` = step count + total dependency-edge count, a disclosed, non-fabricated difficulty measure. `resolveRiskLevel(health, validationErrorCount)` — any blocking error makes a plan `"high"` risk outright, regardless of health score; otherwise thresholds at health ≥ 80 (`"low"`) / ≥ 50 (`"medium"`). `compareOperationalPlans(plans)` builds one entry per plan plus a `differences[]` list (healthiest plan, notable complexity spread ≥ 5, count of high-risk plans) — used by `comparePlansAction` for side-by-side template-derived proposals.
