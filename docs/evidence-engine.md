# Evidence Engine

`src/core/operationalPlanning/evidenceEngine.ts` — v2.0 Checkpoint 27.2, Step 8.

## Declarative only — the spec's own boundary

An `EvidenceRequirement` **states what evidence a step or milestone needs** — one of the spec's 9 named types (`photo`/`video`/`document`/`measurement`/`qr_scan`/`barcode_scan`/`gps_confirmation`/`digital_signature`/`custom`) — this file never captures, stores, or validates an actual piece of evidence. Deliberately, **no `"submitted"`/`"verified"` status exists on `EvidenceRequirement` at all**: that's explicitly out of scope until a future Dispatch/Field Operations checkpoint builds real capture. The Stop Condition is unambiguous here — "Do NOT collect evidence. Do NOT capture GPS."

## `evidenceForStep` / `evidenceForMilestone`

```ts
evidenceForStep(evidence, stepId): EvidenceRequirement[]
evidenceForMilestone(evidence, milestoneId): EvidenceRequirement[]
```

Simple filters by `step_id`/`milestone_id`.

## `findOrphanedEvidenceRequirements`

```ts
findOrphanedEvidenceRequirements(evidence, phases, milestones): EvidenceRequirement[]
```

An evidence requirement pointing at neither a real step nor a real milestone in this plan — including one with **both** fields `null` (an unattached requirement is itself orphaned; unlike `Milestone.target_phase_id` or `Deliverable.produced_by_step_id`, an `EvidenceRequirement` must be attached to something).

## Consumers

- `operationalConstraintsEngine.ts` — every orphaned requirement becomes a blocking `missing_evidence` error.
- `operationalHealthEngine.ts` — `computeEvidenceCoverageScore` asks a narrower question: does every *milestone* have at least one declared evidence requirement (`evidence_requirement_ids.length > 0`) — never whether evidence was actually captured, since this checkpoint has no capture concept at all.
- `operationalRiskEngine.ts` — the `missing_evidence` finding.
