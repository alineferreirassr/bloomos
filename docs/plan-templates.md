# Plan Templates

`types/operationalPlanning.ts`'s `PlanTemplate`, `lib/data/mock/planTemplatesStore.ts` — v2.0 Checkpoint 27.2, Steps 2 + 21.

## What it answers

A `PlanTemplate` (e.g. Wedding Proposal, Luxury Picnic, Hotel Decoration, Photoshoot, Drone Inspection, Cleaning Service, Furniture Assembly, Maintenance Visit — the spec's 8 named examples, plus `"custom"`) is a reusable, workspace-owned structure: the same `phases`/`milestones`/`deliverables`/`evidence_requirements`/`checklists`/`approvals` shape an `OperationalPlan` carries, minus any live plan state (status, context, timestamps).

## Instantiation — deep copy, fresh ids, never a live reference

`instantiatePlanStructureFromTemplate` (`modules/operationalPlanning/operationalPlanningActions.ts`) builds a complete `Map<oldId, newId>` for every entity kind (phases, steps, milestones, evidence, deliverables, approvals) *before* touching any object, then rebuilds every object using those maps to rewrite every cross-reference: a step's `dependencies[].step_id`, a milestone's `target_phase_id`/`evidence_requirement_ids`, a deliverable's `produced_by_step_id`, evidence's `step_id`/`milestone_id`, an approval's `phase_id`/`step_id`/`milestone_id`. Every instantiated step resets to `status: "pending"`, every milestone to `"not_started"`, every deliverable to `"pending"`, every approval to `"pending"` with `approved_by`/`approved_at` cleared — a template describes structure, never in-progress state. `createOperationalPlanAction` calls this whenever a caller creates an `OperationalPlan` with a `template_id`.

## Versioning — Step 21's "Version Templates," scoped honestly

`updateTemplate` (`planTemplatesStore.ts`) increments `PlanTemplate.version` on every structural update. **No snapshot history is kept** — this is a disclosed scope decision, not an oversight: building a full Document-Platform-style versioning system (`DocumentVersion`, diffing, rollback) for a spec line that only asked for template versioning generically would be scope creep well beyond what this checkpoint's Stop Condition calls for. A future checkpoint that needs "restore template to version 3" would extend `PlanTemplate` with a snapshot array at that point, not before.

## Lifecycle

`createTemplate` / `updateTemplate` / `setTemplateStatus` (`"active" | "archived"`) / `duplicateTemplate` (fresh id, version reset to 1, `" (Copy)"` suffix, same structure). Archiving writes `archived_at: timestamp`; reactivating clears it back to `null` — the same "don't leave a stale `archived_at` behind" discipline caught reactively in `calendarsStore.ts`/`allocationsStore.ts` and avoided proactively here from the start.

## UI

`PlanTemplateLibraryView` (`/operational-planning/templates`) — read-only listing with per-template phase/step/milestone/deliverable/evidence/approval counts, mirroring `BundleManagementView.tsx`'s exact shape. No create/edit form is wired; `createPlanTemplateAction`/`updatePlanTemplateAction`/`duplicatePlanTemplateAction` exist and are fully tested, ready for a future form — the same disclosed "no create control wired yet" scope every prior platform's template/registry UI carries.
