# Capability Score Engine

v2.0 Checkpoint 26.1, Step 6. `core/capability/capabilityScoreEngine.ts` — twelve named 0-100 scores plus an overall composite. Every formula is a disclosed arithmetic expression; no AI, no randomness.

## The rule that governs every sub-score: not applicable resolves to 100, never 0

When a requirement doesn't constrain a dimension at all (e.g. no `required_skills`/`preferred_skills`), that dimension is vacuously satisfied. Scoring it `0` would misrepresent "this requirement never asked" as "this worker completely failed" — the same "never silently invent a worst case" discipline `priority-engine.md`'s readiness-resolution fallback (Checkpoint 25.7) already established for this codebase.

## Every score, its formula, and its direction

| Score | Formula | Direction |
|---|---|---|
| `eligibilityScore` | `eligible`→100, `conditionally_eligible`→75, `unknown`→50, `ineligible`→0 | Higher = more ready |
| `skillsMatchScore` | Weighted: 70% required-skill satisfaction fraction + 30% preferred-skill match fraction (100 when a side has none) | Higher = better skill fit |
| `certificationScore` | Same weighting; `valid`=1 credit, `expiring_soon`=0.75 credit, else 0 | Higher = stronger certification standing |
| `experienceScore` | 0 if below a hard `minimum_experience_level`; 100 if it meets/exceeds `preferred_experience_level`; otherwise `100 − 20×shortfall`, floored at 40 | Higher = more experienced relative to the ask |
| `languageScore` | Same required/preferred weighting as skills | Higher = better language fit |
| `availabilityScore` | 100 (unconstrained) or binary 100/0 against `required_availability_statuses` | Higher = currently available |
| `equipmentScore` / `vehicleScore` | Same required/preferred weighting, over [`equipment-capabilities.md`](equipment-capabilities.md) / [`vehicle-capabilities.md`](vehicle-capabilities.md) results | Higher = better resource access |
| `locationScore` | Unknown distance → 50 (the documented neutral midpoint, never 0 or 100); with a `maximum_distance_km`, linear decay to 0 at the limit; without one, 1 point lost per km, floored at 0 | Higher = closer |
| `teamFitScore` | 0 for a hard team mismatch; 100 for a match; 60 for a missed *preferred* team (a real gap, never a hard failure) | Higher = better team alignment |
| `capacityScore` | `100 − 20×workerActiveAssignmentCount`, floored at 0 | Higher = more room to take on new work |
| `preferenceScore` | Fraction of all preferences matched (100 if none configured) | Higher = better overall preference fit |
| `overallCapabilityScore` | Weighted composite, see below | Higher = stronger overall match |

## The composite's weights (sum to 1.0, documented here, not scattered)

`eligibility 0.25` (dominant — an ineligible/unknown worker should never outrank an eligible one on overall score alone), `skillsMatch 0.15`, `certification 0.15`, `availability 0.10`, `experience 0.08`, `language 0.05`, `equipment 0.05`, `vehicle 0.05`, `location 0.05`, `capacity 0.03`, `teamFit 0.02`, `preference 0.02`.

## Traceability

Every `CapabilityExplanation.scoreBreakdown` (`capabilityExplanationEngine.ts`) lists all twelve named scores plus the overall — the Requirement Detail view's "Explain" panel renders this directly, never collapsing a worker's evaluation into a bare number.
