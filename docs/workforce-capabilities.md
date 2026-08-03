# Workforce Capability & Eligibility Platform

v2.0 Checkpoint 26.1. Determines which workers are genuinely qualified and operationally ready to perform a specific work requirement — deterministically, never with scheduling, dispatch, route optimization, or AI. Builds entirely on top of Checkpoint 26's Workforce Foundation (Workers, Teams, Availability, Skills, Assignments, Equipment, Vehicles, Location) — no engine here re-implements anything that domain already computes.

## The five questions this checkpoint answers

- **Who is eligible?** [`eligibility-engine.md`](eligibility-engine.md) — a strict, deterministic evaluation returning `eligible | conditionally_eligible | ineligible | unknown`.
- **Who is capable?** [`capability-scoring.md`](capability-scoring.md) — twelve named 0-100 scores plus an overall composite.
- **Who is operationally ready right now?** The Availability Engine's `resolveCurrentAvailability` (Checkpoint 26), reused, not recomputed.
- **Why is a worker eligible or ineligible?** Every `CapabilityEligibility` carries the exact rule that blocked or satisfied each check — see [`eligibility-engine.md`](eligibility-engine.md)'s explanation section.
- **Which worker is the strongest match?** [`worker-ranking.md`](worker-ranking.md) — a deterministic, multi-key sort.

## Architecture

| Module | File | Responsibility |
|---|---|---|
| Domain types | `types/capability.ts` | `CapabilityRequirement`, `CapabilityEligibility`, `CapabilityScores`, `WorkforceRisk`, etc. — see [`capability-requirements.md`](capability-requirements.md) |
| Capability Requirement Registry | `lib/data/mock/capabilityRequirementsStore.ts` | CRUD + duplicate + filter by context/skill/certification/team |
| Evaluation snapshots | `lib/data/mock/capabilityEvaluationSnapshotsStore.ts` | Prior-evaluation storage so Timeline events only fire on real transitions |
| EligibilityEngine | `core/capability/eligibilityEngine.ts` | Steps 3-5 — see [`eligibility-engine.md`](eligibility-engine.md) |
| CapabilityScoreEngine | `core/capability/capabilityScoreEngine.ts` | Step 6 — see [`capability-scoring.md`](capability-scoring.md) |
| CapabilityExplanationEngine | `core/capability/capabilityExplanationEngine.ts` | Step 7 — turns the structured result into a human-readable narrative |
| WorkerRankingEngine | `core/capability/workerRankingEngine.ts` | Step 8 — see [`worker-ranking.md`](worker-ranking.md) |
| CertificationCapabilityEngine | `core/capability/certificationCapabilityEngine.ts` | Step 12 — see [`certification-capabilities.md`](certification-capabilities.md) |
| EquipmentCapabilityEngine | `core/capability/equipmentCapabilityEngine.ts` | Step 10 — see [`equipment-capabilities.md`](equipment-capabilities.md) |
| VehicleCapabilityEngine | `core/capability/vehicleCapabilityEngine.ts` | Step 11 — see [`vehicle-capabilities.md`](vehicle-capabilities.md) |
| LocationCompatibilityEngine | `core/capability/locationCompatibilityEngine.ts` | Step 9 — deterministic haversine distance only |
| AssignmentConflictEngine | `core/capability/assignmentConflictEngine.ts` | Step 14 — reuses Checkpoint 26's Assignment store |
| CapabilityCoverageEngine | `core/capability/capabilityCoverageEngine.ts` | Step 19 — see [`capability-coverage.md`](capability-coverage.md) |
| CapabilityRiskEngine | `core/capability/capabilityRiskEngine.ts` | Step 20 — see [`capability-risks.md`](capability-risks.md) |
| CapabilityTimelineEngine | `core/capability/capabilityTimelineEngine.ts` | Step 17 — 10 named Timeline events |
| CapabilityFindingsEngine | `core/capability/capabilityFindingsEngine.ts` | Step 18 — translates `WorkforceRisk[]` into the Executive Decision Platform's own `OperationalRecommendation` contract |
| Module layer | `modules/capability/capabilityActions.ts` | The single orchestrator — CRUD actions, `evaluateCapabilityRequirementAction`, `evaluateWorkforceCapabilityCoverageAction`, `evaluateWorkerCapabilityAction` |
| Dashboard | `modules/capability/components/CapabilityDashboardView.tsx` at `/assets/workforce/capabilities` | Coverage/risk summary + requirement list |
| Requirement detail | `modules/capability/components/RequirementDetailView.tsx` at `/assets/workforce/capabilities/[id]` | Full per-worker eligibility, ranking, score breakdown, explanation |
| Worker capability view | `modules/capability/components/WorkerCapabilityView.tsx` at `/assets/workforce/workers/[id]` | Step 23 — a new Worker detail page (none existed before this checkpoint) |

## Reuse, honored exactly as the stop condition requires

- **Availability** — every eligibility check calls `resolveCurrentAvailability` (Checkpoint 26's own function), never a second availability calculation.
- **Skills/Certifications** — read directly off `Worker.skills`/`Worker.certifications` (Checkpoint 26 fields); `CertificationCapabilityEngine` classifies, it doesn't store.
- **Assignment** — conflict detection reads Checkpoint 26's `Assignment` rows directly; no scheduling engine was created.
- **Equipment/Vehicle Registry** — both capability engines read `Equipment`/`Vehicle` rows directly; no second registry.
- **Knowledge Graph** — `evaluated_for`/`eligible_for`/`conditionally_eligible_for`/`ineligible_for` relationships reuse the existing single relationship system (`types/knowledgeGraph.ts`'s `RelationshipType`), created only for saved requirements with a real context node, never per-transient-evaluation spam.
- **Business Health / Objectives / Executive Decisions** — `capabilityFindingsEngine.ts` translates `WorkforceRisk[]` into `OperationalRecommendation[]`, fed into the Executive Decision Platform's existing `recommendationSources` array as one more contributor. No second recommendation or decision engine was created.
- **No AI, no randomness anywhere** — every score, rank, and risk detection is a disclosed, deterministic function over already-computed Checkpoint 26 data.

## Additive extensions to Checkpoint 26

Two small, disclosed additions were necessary to answer questions this checkpoint's spec asked but Checkpoint 26 had no field for — both are purely additive, nothing existing changed shape:

1. **`Worker.experience_level`** (`ExperienceLevel`: entry/intermediate/senior/expert) and **`Worker.languages`** (`string[]`) — Checkpoint 26 had no experience concept at all, and `Worker.language` (singular) can't answer a multi-language requirement honestly.
2. **`Vehicle.vehicle_type`** (`string`) — mirrors `Equipment.category` exactly; Checkpoint 26's `Vehicle` had `make`/`model` but no categorical "type" a requirement author would actually write.

Both default sensibly for every Checkpoint 26 call site that predates them (`languages` defaults to `[language]`, `experience_level` defaults to `"entry"`) so no existing code broke — confirmed by the full 670-file test suite passing unchanged.

## What this checkpoint does NOT include

No scheduling, no calendar bookings, no dispatch, no route optimization, no travel-time estimation, no maps, no AI, no automatic worker assignment — per the spec's own stop condition. This is the deterministic eligibility, capability, ranking, explanation, coverage, and risk foundation a future Scheduling Platform can consume without reimplementing any of it.

See [`v2-checkpoint-26.1.md`](v2-checkpoint-26.1.md) for the full certification report.
