# v2.0 Checkpoint 27.2 — Operational Planning Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Capability (26.1) determines **WHO** is capable. Scheduling (27) determines **WHEN** work can happen. Resource Allocation (27.1) determines **WHICH resources** should be used. Operational Planning determines **HOW the operation should be executed** — reusable execution plans only. Dispatch (a future checkpoint) will later execute an approved plan; every engine here is a pure, deterministic function over already-computed data — no AI, no randomness, no worker dispatch, no live execution, no evidence capture, no GPS, no route optimization.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/operationalPlanning.ts` | `OperationalPlan`/`PlanTemplate` + 11 nested entity shapes + 8 computed-only result shapes — see [`operational-planning.md`](operational-planning.md) |
| 3 mock stores | `lib/data/mock/{operationalPlans,planTemplates,checklistTemplates}Store.ts` | [`plan-templates.md`](plan-templates.md), [`checklists.md`](checklists.md) |
| Phase Engine | `core/operationalPlanning/phaseEngine.ts` | [`phases.md`](phases.md) — 9 named phase kinds |
| Execution Step Engine | `core/operationalPlanning/executionStepEngine.ts` | [`execution-steps.md`](execution-steps.md) — dependencies + cycle detection |
| Milestone / Deliverable / Evidence / Checklist / Approval Engines | `core/operationalPlanning/{milestone,deliverable,evidence,checklist,approval}Engine.ts` | [`milestones.md`](milestones.md), [`deliverables.md`](deliverables.md), [`evidence-engine.md`](evidence-engine.md), [`checklists.md`](checklists.md), [`approval-engine.md`](approval-engine.md) |
| Constraints / Critical Path / Health / Explanation / Comparison | `core/operationalPlanning/{operationalConstraintsEngine,criticalPathEngine,operationalHealthEngine,operationalExplanationEngine,operationalComparisonEngine}.ts` | [`critical-path.md`](critical-path.md) — 9 named validation checks, 8 named health scores |
| Operational Timeline Engine | `core/operationalPlanning/operationalTimelineEngine.ts` | 10 named Timeline events |
| Operational Knowledge Graph Engine | `core/operationalPlanning/operationalKnowledgeGraphEngine.ts` | 1 live relationship, 7 reserved |
| Operational Risk Engine / Findings Engine | `core/operationalPlanning/{operationalRiskEngine,operationalFindingsEngine}.ts` | 8 named findings → Executive Decisions |
| Module layer | `modules/operationalPlanning/operationalPlanningActions.ts` | Full CRUD + template instantiation + `evaluateOperationalPlanAction`/`comparePlansAction`/`evaluateOperationalPlanningHealthAction` |
| Dashboards | `/operational-planning`, `/operational-planning/plans/[id]`, `/operational-planning/templates` | [`operations-dashboard.md`](operations-dashboard.md) |

## Reuse, honored exactly as the stop condition requires

- **Capability, Scheduling, Allocation, Knowledge Graph, Executive Decisions, Operational Intelligence** — never duplicated. `ExecutionStep.required_capability_requirement_id` references a real, already-built Checkpoint 26.1 `CapabilityRequirement` — never a re-declared skill/certification list. `checkMissingSchedule` reads Checkpoint 27's real `Appointment` data directly rather than re-implementing availability logic. Nothing here selects a resource (`ResourceType` is a category, never a resolved candidate id) or books a time slot — those stay Allocation's and Scheduling's jobs respectively.
- **Knowledge Graph** — reuses the single existing `RelationshipType` system; `produces_deliverable` is a new *value* in that one closed list, never a second relationship mechanism. `OperationalPlan`/`ExecutionPhase`/`ExecutionStep`/`Milestone`/`EvidenceRequirement`/`ApprovalRequirement` correctly get no `KnowledgeNodeType` — plain records inside a plan's own aggregate document, the same discipline `CapabilityRequirement`/`Calendar`/`Allocation` held to.
- **Timeline** — every structural mutation records through the same `recordTimelineActivity` every checkpoint uses; the pure-read `evaluateOperationalPlanAction`/`comparePlansAction`/`evaluateOperationalPlanningHealthAction` emit nothing, so viewing a plan or the dashboard never spams the log.
- **Executive Decisions** — `operationalPlanningRecommendationsForExecutiveDecisions()` translates `OperationalFinding[]` into the existing `OperationalRecommendation` shape and is wired into `executiveDecisionsActions.ts`'s `recommendationSources` array as one more contributor (`generatedBy: "operational_planning_engine"`), additive — confirmed by the full pre-existing Executive Decisions test suite still passing unchanged.
- **Permissions** — `operational_planning.view`/`operational_planning.manage` follow the exact `allocations.view`/`allocations.manage` narrower-manage/broader-view precedent, collapsing the spec's 7 named capabilities into 2 permissions.
- **No AI, no randomness, no live execution anywhere** — every score, validation check, and risk detection is a disclosed formula or deterministic comparison. `EvidenceRequirement` deliberately carries no `"submitted"`/`"verified"` status; `ApprovalType.automatic_rule_placeholder` deliberately has no automation behind it.

## No bugs this checkpoint's own test suite needed to catch

Unlike Checkpoint 27.1 (a real zero-candidate rejection bug in `allocationsStore.createAllocation`), `operationalPlanningActions.test.ts`'s 21 tests — including the complex template-instantiation id-remapping logic (`instantiatePlanStructureFromTemplate`, verified correct across every cross-reference: step dependencies, milestone `target_phase_id`/`evidence_requirement_ids`, deliverable `produced_by_step_id`, evidence `step_id`/`milestone_id`, approval `phase_id`/`step_id`/`milestone_id`) — passed cleanly on the first run. `operationalPlansStore.ts`'s `setPlanStatus` was written from the start with `archived_at: status === "archived" ? timestamp : null`, proactively avoiding the reactivation bug pattern that had to be fixed reactively in `calendarsStore.ts`/`allocationsStore.ts` during prior checkpoints.

## Known limitations (disclosed, not hidden)

1. **No creation UI for `OperationalPlan`/`PlanTemplate`/`ChecklistTemplate`, and no button wires any structural-mutation or approval action.** The same precedent Calendars, Capability Requirements, and Resource Allocation established — entities are created through the module action layer, exercised directly in tests; the three dashboards cover every read/evaluate surface the spec asked for. `evaluateOperationalPlanAction` is the one exception, wired directly because it's a genuine read (re-deriving already-computed validation/health/explanation/critical-path data, never mutating).
2. **7 of 8 Knowledge Graph relationship types are registered but never emitted.** `operational_plan`, `execution_phase`, `execution_step`, `milestone`, `requires_evidence`, `requires_approval`, `depends_on_step` are reserved vocabulary — the same disclosed-gap discipline `blocks`/`occurs_during` (Scheduling) and `allocation_candidate`/`allocation_bundle` (Allocation) established, and an even more conservative live/reserved ratio than either, because this checkpoint's entire domain is genuinely self-contained registry data with no real node identity of its own.
3. **Plan Template versioning is a bare counter, no snapshot history.** `PlanTemplate.version` increments on every structural update; there's no "restore to version 3." Building a full Document-Platform-style versioning system for a spec line that only asked for template versioning generically would be scope creep beyond this checkpoint's Stop Condition — disclosed in [`plan-templates.md`](plan-templates.md).
4. **`automatic_rule_placeholder` has no automation behind it.** A real, storable `ApprovalType` value with zero rule-evaluation logic — a disclosed hook for a future Automation Platform integration, never a live automatic-approval path.
5. **Evidence is purely declarative — no capture, no verification status.** `EvidenceRequirement` has no `"submitted"`/`"verified"` field at all; that's out of scope until a future Dispatch/Field Operations checkpoint builds real capture, per the Stop Condition's explicit "Do NOT collect evidence. Do NOT capture GPS."
6. **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: clean (0 errors; pre-existing unrelated warnings only)
- `vitest run`: **6793/6793 tests passing** across 742 files (115 new tests across 20 new files for this platform alone: 16 core engine test files, 3 mock store test files [folded into 16], the `operationalPlanningActions.ts` integration suite, and 3 dashboard component test files)
- `next build`: succeeds, including the three new `/operational-planning`, `/operational-planning/plans/[id]`, and `/operational-planning/templates` routes

## Success criteria, answered

- **How should the operation be executed?** `OperationalPlan.phases` — an ordered sequence of `ExecutionPhase`s, each carrying its own `ExecutionStep`s with dependencies, assigned resource type, and required capability.
- **Can a reusable structure (e.g. "Wedding Proposal") generate a plan?** `instantiatePlanStructureFromTemplate`, wired into `createOperationalPlanAction` — a full deep copy with fresh ids and every cross-reference rewritten, never a live reference.
- **What must happen before the operation can proceed?** `Milestone`/`Deliverable`/`EvidenceRequirement`/`ApprovalRequirement` — declarative requirements only; `ApprovalEngine`/`decideApprovalAction` track approval state without automating a single decision.
- **Is the plan structurally sound?** `validateOperationalConstraints` — 9 named checks, composing every engine this checkpoint built.
- **What's the longest chain of work, and what can run in parallel?** `computeCriticalPath` — dependency analysis only, no scheduling optimization.
- **How healthy is a plan, and can two plans be compared?** `OperationalHealthScores` (8 disclosed component scores) via `computeOperationalHealthScores`, and `compareOperationalPlans` for side-by-side template-derived proposals.
- **Can a future Dispatch Platform consume an approved plan without reimplementing planning logic?** Yes — `evaluateOperationalPlanAction` returns a complete, typed `OperationalPlanResult` (plan + validation + health + explanation + critical path) a dispatcher can read directly, and every `ExecutionStep`/`Milestone`/`Deliverable`/`EvidenceRequirement`/`ApprovalRequirement` is already the exact structure a future Dispatch checkpoint would execute against.

Stop condition honored throughout: no worker dispatch, no operational step execution, no evidence collection, no GPS capture, no live tracking, no route optimization, no automated approvals, no AI, no duplicated Allocation/Scheduling/Capability/Knowledge Graph/Executive Decisions/Operational Intelligence logic.
