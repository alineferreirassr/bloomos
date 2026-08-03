# Eligibility Engine

v2.0 Checkpoint 26.1, Steps 3-5. `core/capability/eligibilityEngine.ts`'s `evaluateEligibility(requirement, context)` — strict, deterministic, pure.

## Four states

```ts
const ELIGIBILITY_STATES = ["eligible", "ineligible", "conditionally_eligible", "unknown"] as const;
```

- **`eligible`** — every hard requirement satisfied, no caveats.
- **`conditionally_eligible`** — every hard requirement satisfied, but with a real caveat (currently: a required certification is `expiring_soon`). Unmatched *preferences* never produce this state — only a genuine, disclosed caveat does.
- **`ineligible`** — at least one hard requirement failed. `blockingReasons` names every one.
- **`unknown`** — eligibility couldn't be fully determined (currently: a `maximum_distance_km` is configured but the worker has no location snapshot). Never confused with `ineligible` — a real "can't tell" is different from a real "no."

## Every hard check, in order, each naming its own rule

1. `worker_status` — must be `"active"`.
2. `employment_type` — if `required_employment_types` is non-empty.
3. `availability` — current status (via Checkpoint 26's `resolveCurrentAvailability`) against `required_availability_statuses`.
4. `required_skill:<name>` — one check per named skill.
5. `required_certification:<name>` — delegates to [`certification-capabilities.md`](certification-capabilities.md); `expired`/`unverified`/`missing` block, `expiring_soon` doesn't.
6. `required_language:<name>` — checked against `Worker.languages` (plural — see `docs/workforce-capabilities.md`'s additive-extensions section).
7. `minimum_experience_level` — worker's rank must be ≥ the required rank.
8. `required_equipment:<type>` — delegates to [`equipment-capabilities.md`](equipment-capabilities.md).
9. `required_vehicle:<type>` — delegates to [`vehicle-capabilities.md`](vehicle-capabilities.md).
10. `required_team` — worker's `team_id` must match.
11. `excluded_worker` / `excluded_team`.
12. `maximum_distance` — delegates to the Distance Foundation (see `docs/workforce-capabilities.md`'s Step 9 note); unknown distance produces `unknown` state, never a block.
13. `conflicting_assignment` — only checked when the requirement's `context_type` is also a real `AssignableType` (event/client/asset/vehicle/equipment/vendor); `team`/`workspace`/`project_placeholder` contexts have no Assignment concept to conflict against.
14. `custom_rule:<id>` — one per configured `CapabilityCustomRule`.

Every failing check calls `block(rule, detail)`, which appends to both `blockingReasons` (with the human-readable detail) and `unsatisfiedHardRequirements` (the bare rule name) — the exact rule that caused ineligibility is always traceable, per the spec's own requirement.

## Soft preferences never block

Every preference (`preferred_skills`, `preferred_certifications`, `preferred_languages`, `preferred_equipment_types`, `preferred_vehicle_types`, `preferred_team_id`, `preferred_experience_level`) is recorded into `matchedPreferences`/`unmatchedPreferences` only — never `blockingReasons`. Confirmed by a dedicated regression test (`eligibilityEngine.test.ts`'s "soft preferences never block" suite) asserting a requirement with every preference unmatched still resolves `eligible`.

## The full explanation, not a bare state

Every `CapabilityEligibility` also carries: `satisfiedHardRequirements`, `unsatisfiedHardRequirements`, `expiringSoonCertifications`, `unavailableResources` (e.g. `"equipment:drone"`), and `fallbacksUsed` (e.g. `"distance:unknown (This worker has no recorded location snapshot.)"`) — every one of the spec's own named explanation questions has a real, populated field. See [`capability-scoring.md`](capability-scoring.md) for how `CapabilityExplanationEngine` turns this into prose.
