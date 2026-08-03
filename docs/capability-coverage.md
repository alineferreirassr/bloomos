# Capability Coverage Engine

v2.0 Checkpoint 26.1, Step 19. `core/capability/capabilityCoverageEngine.ts`'s `computeCapabilityCoverage(input)` — a pure, workspace-level rollup over already-computed `RequirementEvaluationResult[]` plus raw Worker/Team/Equipment/Vehicle rows. No new evaluation happens here, only aggregation.

## Coverage tallies

- **`skillsCoverage`** / **`languageCoverage`** — a count of active workers holding each named skill/language.
- **`certificationCoverage`** — a count of active workers holding a *genuinely usable* instance of each certification: verified and not expired. A revoked or lapsed certification doesn't count as real coverage.
- **`equipmentCoverage`** / **`vehicleCoverage`** — a count of currently-`available` items per category/type.
- **`availableWorkersCount`** / **`activeTeamsCount`** — pass-through counts for the dashboard's KPI cards.

## Requirement coverage & "uncovered"

For every evaluated requirement:

```ts
interface RequirementCoverageEntry {
  requirementId: string;
  eligibleCount: number;
  conditionallyEligibleCount: number;
  capacityRequirement: number | null;
  meetsCapacity: boolean; // eligibleCount + conditionallyEligibleCount >= (capacityRequirement ?? 1)
}
```

A requirement is **uncovered** exactly when `meetsCapacity` is false — `capacity_requirement: null` defaults to needing at least 1 qualified worker, the same "unset means the ordinary minimum" default the rest of this checkpoint uses.

## Single points of failure

- **`singleWorkerDependencies`** — every requirement where exactly one worker is ranked (rank ≠ null).
- **`singleEquipmentDependencies`** / **`singleVehicleDependencies`** — an equipment category or vehicle type with exactly one `available` instance workspace-wide, *and* that type is actually named by at least one requirement's `required_equipment_types`/`required_vehicle_types`. A rare-but-irrelevant category with one instance is never flagged — only real dependencies are.

## `highRiskGapsCount`

`uncoveredRequirementIds.length + singleWorkerDependencies.length + singleEquipmentDependencies.length + singleVehicleDependencies.length` — a self-contained, disclosed rollup that doesn't depend on `capabilityRiskEngine.ts`'s own output, so the Coverage Engine stays a pure, standalone aggregation.
