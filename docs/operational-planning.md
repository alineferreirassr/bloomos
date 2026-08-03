# Operational Planning Platform — Architecture

v2.0 Checkpoint 27.2. Capability (26.1) determines **WHO** is capable. Scheduling (27) determines **WHEN** work can happen. Resource Allocation (27.1) determines **WHICH resources** should be used. Operational Planning determines **HOW the operation should be executed** — reusable execution plans only. Dispatch (a future checkpoint) will later execute an approved plan; every engine here is a pure, deterministic function over already-computed data — no AI, no randomness, no worker dispatch, no live execution, no evidence capture, no GPS, no route optimization.

## Module map

| Module | File | Doc |
|---|---|---|
| Domain types | `types/operationalPlanning.ts` | Below |
| 3 mock stores | `lib/data/mock/{operationalPlans,planTemplates,checklistTemplates}Store.ts` | [`plan-templates.md`](plan-templates.md), [`checklists.md`](checklists.md) |
| Accessors | `core/operationalPlanning/index.ts` | — |
| Phase Engine | `core/operationalPlanning/phaseEngine.ts` | [`phases.md`](phases.md) |
| Execution Step Engine | `core/operationalPlanning/executionStepEngine.ts` | [`execution-steps.md`](execution-steps.md) |
| Milestone Engine | `core/operationalPlanning/milestoneEngine.ts` | [`milestones.md`](milestones.md) |
| Deliverable Engine | `core/operationalPlanning/deliverableEngine.ts` | [`deliverables.md`](deliverables.md) |
| Evidence Engine | `core/operationalPlanning/evidenceEngine.ts` | [`evidence-engine.md`](evidence-engine.md) |
| Checklist Engine | `core/operationalPlanning/checklistEngine.ts` | [`checklists.md`](checklists.md) |
| Approval Engine | `core/operationalPlanning/approvalEngine.ts` | [`approval-engine.md`](approval-engine.md) |
| Constraints / Health / Explanation / Comparison / Critical Path | `core/operationalPlanning/{operationalConstraintsEngine,operationalHealthEngine,operationalExplanationEngine,operationalComparisonEngine,criticalPathEngine}.ts` | [`critical-path.md`](critical-path.md) |
| Operational Timeline Engine | `core/operationalPlanning/operationalTimelineEngine.ts` | Below |
| Operational Knowledge Graph Engine | `core/operationalPlanning/operationalKnowledgeGraphEngine.ts` | Below |
| Operational Risk Engine / Findings Engine | `core/operationalPlanning/{operationalRiskEngine,operationalFindingsEngine}.ts` | Below |
| Module layer | `modules/operationalPlanning/operationalPlanningActions.ts` | Below |
| Dashboards | `/operational-planning`, `/operational-planning/plans/[id]`, `/operational-planning/templates` | [`operations-dashboard.md`](operations-dashboard.md) |

## Domain shape — one aggregate document per plan

`OperationalPlan`/`PlanTemplate` carry `phases[]` (each phase carrying its own `steps[]` inline) plus top-level `milestones[]`/`deliverables[]`/`evidence_requirements[]`/`checklists[]`/`approvals[]` arrays — read and written as one whole, the same "whole graph as one document" precedent the Workflow Builder (Checkpoints 12/13) established. A Plan Detail page reads the entire tree at once and nothing here is ever queried step-by-step independently of its plan.

`ExecutionStep` reuses `ResourceType` from `types/allocation.ts` (a category, never a resolved candidate id — binding an actual Worker/Equipment is Dispatch's job) and `AppointmentPriority` from `types/scheduling.ts` directly, rather than re-declaring either.

## Route naming — `/operational-planning`, not `/operations`

Checkpoint 21's Operations Dashboard already owns `/operations` — a genuinely distinct concept (live event execution) from this checkpoint's reusable execution *plans*. Resolved by using `/operational-planning` instead, disclosed explicitly in `routeAccess.ts`'s own comment.

## Operational Timeline Engine — the 10 named events

`plan_created/updated/approved/archived`, `phase_added`, `step_added`, `milestone_completed`, `approval_required`, `deliverable_added`, `evidence_requirement_added`. Pure `{ type, description }` builders; `operationalPlanningActions.ts` calls them only on a real structural mutation — the pure-read `evaluateOperationalPlanAction`/`comparePlansAction`/`evaluateOperationalPlanningHealthAction` emit nothing, so viewing a plan or the dashboard never spams the Timeline.

## Operational Knowledge Graph Engine — 1 live relationship, 7 reserved

`OperationalPlan`/`ExecutionPhase`/`ExecutionStep`/`Milestone`/`EvidenceRequirement`/`ApprovalRequirement` have no node identity of their own — plain records inside a plan's own aggregate document, not Knowledge Graph nodes, the same discipline `CapabilityRequirement`/`Calendar`/`Allocation` held to before them. `produces_deliverable` is the one live edge: a plan's own context node → the real Document/MediaAsset node a `Deliverable.linked_node` names, when set. `operational_plan`, `execution_phase`, `execution_step`, `milestone`, `requires_evidence`, `requires_approval`, `depends_on_step` are registered as reserved vocabulary in `RelationshipType`, never emitted — the same disclosed-gap discipline `blocks`/`occurs_during` established for Scheduling, `allocation_candidate`/`allocation_bundle` for Allocation.

## Operational Risk Engine / Findings Engine — Executive Integration

`detectOperationalRisks()` runs 8 named, deterministic detectors (Missing Operational Plan, Missing Evidence, Missing Deliverables, Approval Bottleneck, Critical Dependency, Incomplete Plan, High Operational Complexity, Missing Checklist) over already-computed data. `operationalFindingsToRecommendations()` translates the result into the Executive Decision Platform's existing `OperationalRecommendation` shape — the same "translate, don't duplicate" discipline `allocationFindingsEngine.ts`/`schedulingFindingsEngine.ts`/`capabilityFindingsEngine.ts` established. Wired into `executiveDecisionsActions.ts`'s `recommendationSources` as one more contributor (`generatedBy: "operational_planning_engine"`), additive — a workspace with no operational plans contributes zero findings beyond "Missing Operational Plan" for its real Events with no plan.

## Module layer — `operationalPlanningActions.ts`

Full CRUD for `ChecklistTemplate`/`PlanTemplate`/`OperationalPlan`, plus the orchestration every UI surface reads from:

- **`createOperationalPlanAction`** — with a `template_id`, deep-copies the template's entire structure via `instantiatePlanStructureFromTemplate` (fresh ids for every phase/step/milestone/deliverable/evidence requirement/approval, every cross-reference rewritten through per-kind id maps) — never a live reference back to the template.
- **10 granular structure-mutation actions** — `addPhaseAction`, `addStepToPhaseAction`, `addMilestoneAction`, `completeMilestoneAction`, `addDeliverableAction`, `addEvidenceRequirementAction`, `addApprovalRequirementAction`, `decideApprovalAction`, `attachChecklistFromTemplateAction`, `toggleChecklistItemAction` — each records its own named Timeline event where applicable.
- **`evaluateOperationalPlanAction(planId)`** — composes `validateOperationalConstraints` + `checkMissingSchedule` (the one cross-module read into real Checkpoint 27 `Appointment` data) + `computeOperationalHealthScores` + `computeCriticalPath` + `explainOperationalPlan` into one `OperationalPlanResult`.
- **`approvePlanAction`/`archivePlanAction`** — approval blocks on any blocking validation error or a pending approval requirement; both record their named Timeline event.
- **`comparePlansAction(planIds)`** — evaluates each plan independently, then runs `compareOperationalPlans`.
- **`evaluateOperationalPlanningHealthAction()`** — the Operational Dashboard's and Executive Decisions' shared data source: re-derives validation/health/complexity for every plan, cross-references real Events with no plan at all, then runs `detectOperationalRisks`.

Same minimal session-gate discipline `workforceActions.ts`/`capabilityActions.ts`/`schedulingActions.ts`/`allocationActions.ts` use — every action only checks `session.kind !== "active"`, no additional inline permission checks; `operational_planning.manage` exists in `permissionMatrix.ts` for future UI-level gating.

## Permissions

`operational_planning.view`/`operational_planning.manage` collapse the spec's 7 named capabilities into 2 permissions, following the `allocations.view`/`allocations.manage` narrower-manage/broader-view precedent. `manager` gets both; `staff` gets only `view`.
