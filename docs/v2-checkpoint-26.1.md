# v2.0 Checkpoint 26.1 — Workforce Capability & Eligibility Platform

## Verdict: APPROVED WITH LIMITATIONS

## What was built

Checkpoint 26.1 answers a question Checkpoint 26's foundation (Workers, Teams, Availability, Skills, Assignments, Equipment, Vehicles) never asked: given a specific work requirement, which workers are genuinely qualified and operationally ready to do it, why, and who's the strongest match? Every engine here is a pure, deterministic function over already-computed Checkpoint 26 data — no scheduling, no dispatch, no route optimization, no AI, no randomness.

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/capability.ts` | See [`capability-requirements.md`](capability-requirements.md) |
| Capability Requirement Registry | `lib/data/mock/capabilityRequirementsStore.ts` | CRUD + duplicate + filters |
| Evaluation snapshots | `lib/data/mock/capabilityEvaluationSnapshotsStore.ts` | Prior-evaluation storage for Timeline noise avoidance |
| EligibilityEngine | `core/capability/eligibilityEngine.ts` | See [`eligibility-engine.md`](eligibility-engine.md) |
| CapabilityScoreEngine | `core/capability/capabilityScoreEngine.ts` | See [`capability-scoring.md`](capability-scoring.md) |
| CapabilityExplanationEngine | `core/capability/capabilityExplanationEngine.ts` | Turns the structured result into readable prose |
| WorkerRankingEngine | `core/capability/workerRankingEngine.ts` | See [`worker-ranking.md`](worker-ranking.md) |
| CertificationCapabilityEngine | `core/capability/certificationCapabilityEngine.ts` | See [`certification-capabilities.md`](certification-capabilities.md) |
| EquipmentCapabilityEngine | `core/capability/equipmentCapabilityEngine.ts` | See [`equipment-capabilities.md`](equipment-capabilities.md) |
| VehicleCapabilityEngine | `core/capability/vehicleCapabilityEngine.ts` | See [`vehicle-capabilities.md`](vehicle-capabilities.md) |
| LocationCompatibilityEngine | `core/capability/locationCompatibilityEngine.ts` | Deterministic haversine distance, unknown never treated as zero |
| AssignmentConflictEngine | `core/capability/assignmentConflictEngine.ts` | Reuses Checkpoint 26's Assignment store |
| CapabilityCoverageEngine | `core/capability/capabilityCoverageEngine.ts` | See [`capability-coverage.md`](capability-coverage.md) |
| CapabilityRiskEngine | `core/capability/capabilityRiskEngine.ts` | See [`capability-risks.md`](capability-risks.md) |
| CapabilityTimelineEngine | `core/capability/capabilityTimelineEngine.ts` | 10 named Timeline events |
| CapabilityFindingsEngine | `core/capability/capabilityFindingsEngine.ts` | Translates risks into the Executive Decision Platform's `OperationalRecommendation` contract |
| Module layer | `modules/capability/capabilityActions.ts` | CRUD + `evaluateCapabilityRequirementAction` + `evaluateWorkforceCapabilityCoverageAction` + `evaluateWorkerCapabilityAction` |
| Dashboards | `/assets/workforce/capabilities`, `/assets/workforce/capabilities/[id]`, `/assets/workforce/workers/[id]` | See `docs/workforce-capabilities.md`'s Architecture table |

## Reuse, honored exactly as the stop condition requires

- **Availability, Skills, Assignment, Equipment, Vehicle, Location** — every engine reads Checkpoint 26's own stores/functions directly (`resolveCurrentAvailability`, `Worker.skills`/`certifications`, `Assignment` rows, `Equipment`/`Vehicle` rows, `LocationSnapshot`). Nothing was recomputed or duplicated.
- **Knowledge Graph** — reuses the single existing `RelationshipType` system (`types/knowledgeGraph.ts`); `evaluated_for`/`eligible_for`/`conditionally_eligible_for`/`ineligible_for` are new *values* in that one closed list, never a second relationship mechanism, and are only ever created for saved requirements with a real context node — never one edge per transient evaluation.
- **Timeline** — every lifecycle/evaluation transition records through the same `recordTimelineActivity` every checkpoint uses, guarded by the same diff-against-a-snapshot discipline `businessHealthActions.ts` established, so re-evaluating an unchanged requirement produces zero Timeline noise (verified by a dedicated regression test).
- **Permissions** — `workforce.capabilities.view`/`workforce.capabilities.manage`/`workforce.sensitive_data.view` follow the exact `assets.view`/`assets.manage` narrower-manage/broader-view precedent; no second authorization model.
- **Business Health / Objectives / Executive Decisions** — `capabilityFindingsEngine.capabilityRisksToRecommendations()` translates `WorkforceRisk[]` into the Executive Decision Platform's existing `OperationalRecommendation` shape and is wired into `executiveDecisionsActions.ts`'s `recommendationSources` array as one more contributor (`generatedBy: "workforce_capability_engine"`) — no second recommendation or decision engine was created, confirmed by the full existing Executive Decisions test suite (13 tests) still passing unchanged.
- **No AI, no randomness anywhere** — every score, rank, and risk detection is a disclosed arithmetic formula or deterministic comparison over already-computed numbers.

## Additive extensions to Checkpoint 26 (small, disclosed, backward-compatible)

- `Worker.experience_level` (new, stored, defaults to `"entry"`) and `Worker.languages` (new, stored, defaults to `[language]`) — Checkpoint 26 had no experience concept and `Worker.language` (singular) couldn't answer a multi-language requirement.
- `Vehicle.vehicle_type` (new, stored, required — mirrors `Equipment.category`'s existing precedent exactly).

Every Checkpoint 26 call site that predates these fields was updated to remain valid (7 files for Worker, 6 for Vehicle) — confirmed by the full pre-existing Workforce test suite (117 tests) still passing unchanged, alongside everything else.

## Two real bugs this checkpoint's own test suite caught before shipping

1. **`capabilityRiskEngine.ts`** originally used `continue` right after detecting `no_eligible_worker`, which skipped the equipment/vehicle coverage checks for that same requirement. Caught by `capabilityRiskEngine.test.ts`'s first run; fixed by removing the early `continue` so every check runs independently. See [`capability-risks.md`](capability-risks.md).
2. **`CapabilityDashboardView.tsx`** silently swallowed an error from `evaluateWorkforceCapabilityCoverageAction()` whenever `listCapabilityRequirementsAction()` happened to succeed (an `else if` gated on the wrong branch). Caught by `CapabilityDashboardView.test.tsx`'s error-state test; fixed so either action's failure surfaces.

Both are disclosed here rather than silently fixed, per this session's own discipline of surfacing what testing actually caught.

## Known limitations (disclosed, not hidden)

1. **`requires_skill`/`requires_certification`/`requires_language` were never added as real Knowledge Graph relationships.** Skills, Certifications, and Languages have no node identity anywhere in this codebase (they're plain strings on `Worker`); creating an edge to one would require fabricating a fake node, which the spec's own Step 16 explicitly forbids ("Do not create fake Knowledge Graph nodes"). Disclosed in `types/knowledgeGraph.ts`'s own comment, not silently omitted.
2. **`requires_equipment`/`requires_vehicle` relationship types are reserved vocabulary, not yet live edges.** A `CapabilityRequirement` names equipment/vehicles by *type* (`required_equipment_types: string[]`), not by a specific node — there's no single equipment/vehicle instance to point the edge at until a specific one is assigned via the Assignment Engine (which already creates its own `assigned_to` edge). The relationship type is reserved for a future checkpoint that models equipment/vehicle requirements by specific node.
3. **No creation UI form for Capability Requirements.** Given the requirement model's ~30 fields, building a full form was out of scope this checkpoint — requirements are created via `createCapabilityRequirementAction` (exercised directly in tests), and the Dashboard/Detail/Worker views cover every read/evaluate/explain surface the spec asked for. The same precedent Objectives and Executive Decisions established (no creation form; Decisions are generated, Objectives were created via the action layer too).
4. **Equipment/Vehicle capacity, insurance, and mileage checks have nothing to evaluate.** Checkpoint 26's `Equipment`/`Vehicle` types carry no such fields; per the spec's own "only when operationally relevant"/"only when explicitly configured" language, these checks are correctly inert rather than fabricated. See [`equipment-capabilities.md`](equipment-capabilities.md)/[`vehicle-capabilities.md`](vehicle-capabilities.md).
5. **No live browser verification** — `NEXT_PUBLIC_DATA_MODE=supabase` is configured with real credentials this session has no access to; per policy, a password is never requested in chat. Verified instead through the full quality-gate suite below.

## Quality gates

- `tsc --noEmit`: clean
- `eslint`: 0 errors, 17 pre-existing warnings unrelated to this work (same baseline as Checkpoint 26)
- `vitest run`: **6231/6231 tests passing** across 670 files (133 new tests across 17 files for this platform alone)
- `next build`: succeeds, including the three new `/assets/workforce/capabilities`, `/assets/workforce/capabilities/[id]`, and `/assets/workforce/workers/[id]` routes

## Success criteria, answered

- **Who is eligible to perform this work?** `RequirementEvaluationResult.ranking`, filtered to `eligible`/`conditionally_eligible`.
- **Who is the strongest operational match?** The ranking's own #1 — `WorkerRankingEngine`'s deterministic multi-key sort.
- **Why is a worker eligible or ineligible?** `CapabilityExplanation` — every blocking reason, satisfied requirement, matched/unmatched preference, expiring certification, and fallback used, named explicitly.
- **Which hard requirement is blocking eligibility?** `CapabilityBlockingReason.rule` — always the exact check that failed, never a bare message.
- **Which preferences improved the ranking?** `matchedPreferences`, feeding `preferenceScore` and the ranking's score-based tiebreakers.
- **Does the workforce have enough capability coverage?** `CapabilityCoverageReport.uncoveredRequirementIds`/`requirementCoverage`.
- **Where are the workforce single points of failure?** `singleWorkerDependencies`/`singleEquipmentDependencies`/`singleVehicleDependencies`.
- **Which certifications, equipment, or vehicles create operational risk?** `WorkforceRisk[]` — 12 named, deterministic detectors.
- **Can a future Scheduling Platform consume these results without reimplementing eligibility logic?** Yes — `evaluateCapabilityRequirementAction`/`evaluateWorkforceCapabilityCoverageAction` return complete, typed results (`RequirementEvaluationResult`, `CapabilityCoverageReport`, `WorkforceRisk[]`) a scheduler can read directly.

Stop condition honored throughout: no scheduling, no calendar bookings, no dispatch, no route optimization, no travel-time estimation, no maps, no AI, no automatic worker assignment, no duplicated Availability/Skills/Assignment/Equipment/Vehicle/Knowledge Graph/Business Health/Objectives/Executive Decision logic.
