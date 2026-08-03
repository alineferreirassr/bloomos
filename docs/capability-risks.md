# Workforce Risk Detection

v2.0 Checkpoint 26.1, Step 20. `core/capability/capabilityRiskEngine.ts`'s `detectWorkforceRisks(input)` — twelve named, deterministic detectors over already-computed `RequirementEvaluationResult[]` plus raw workforce data. No AI, no randomness, no new evaluation.

## The twelve risks, each with a real, disclosed trigger

| Risk | Severity | Trigger |
|---|---|---|
| `no_eligible_worker` | high | Zero eligible-or-conditionally-eligible workers for a requirement |
| `single_eligible_worker` | medium | Exactly one qualified worker for a requirement |
| `all_eligible_unavailable` | high | Every qualified worker's `availabilityScore` is 0 — only checked when the requirement actually constrains availability (`required_availability_statuses` non-empty); a requirement with no availability constraint can never trigger this honestly |
| `expired_certification` | medium | Any active worker holds a certification past its `expiration_date` — workspace-wide, not tied to any one requirement |
| `certification_expiring_soon` | low | Same sweep, within the 30-day default threshold |
| `missing_equipment_coverage` / `missing_vehicle_coverage` | high | A requirement names a type with zero `available` instances anywhere in the workspace |
| `team_overreliance` | medium | Every requirement with any qualified worker draws that worker from the same single team, while 2+ active teams exist |
| `worker_overreliance` | high | A worker is the sole qualified person for 2 requirements |
| `worker_critical_capability_overload` | high | A worker is the sole qualified person for 3+ requirements — a stricter tier above `worker_overreliance`, both computed from the same single-worker-dependency count |
| `equipment_single_point_of_failure` / `vehicle_single_point_of_failure` | medium | Exactly one `available` instance of a type some requirement actually needs |

## A real bug this checkpoint's own test suite caught and fixed

The original implementation used `continue` immediately after detecting `no_eligible_worker`, which skipped the equipment/vehicle coverage checks for that same requirement — a requirement with *both* zero eligible workers *and* missing equipment would only ever report the first problem. `capabilityRiskEngine.test.ts`'s "detects missing_equipment_coverage/missing_vehicle_coverage when zero available instances exist" test caught this on first run; the fix removed the early `continue` so every check runs independently per requirement. Disclosed here because it's a good example of why this checkpoint's test suite is written before being asked to trust the engines' output — see [`v2-checkpoint-26.1.md`](v2-checkpoint-26.1.md)'s Known Limitations for a second bug this same discipline caught in the Dashboard.

## Every risk names its own related entity

`WorkforceRisk.relatedRequirementId` / `relatedWorkerId` / `relatedEquipmentId` / `relatedVehicleId` — never a bare description. This is what lets `capabilityFindingsEngine.ts` (Step 18) resolve a real Knowledge Graph node for each risk when translating it into an `OperationalRecommendation` for the Executive Decision Platform.
