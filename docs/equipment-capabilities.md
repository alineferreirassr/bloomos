# Equipment Capability Engine

v2.0 Checkpoint 26.1, Step 10. `core/capability/equipmentCapabilityEngine.ts`'s `evaluateEquipmentCapability(requiredTypes, preferredTypes, workerEquipment, teamEquipment)` — evaluates a requirement's `required_equipment_types`/`preferred_equipment_types` against real `Equipment` rows (Checkpoint 26). Never a second equipment registry.

## Two access paths, two different availability rules

- **Worker's own equipment** (`assigned_worker_id === worker.id`) satisfies a type unless it's `maintenance` or `retired` — it's already theirs; `in_use` still counts.
- **Team-pooled equipment** (assigned to a teammate) only counts while genuinely `available` — it would need to be reassigned, so a teammate already using it doesn't satisfy the requirement.

```ts
const isUsableByWorker = (type) => workerEquipment.some((e) => e.category === type && e.status !== "maintenance" && e.status !== "retired");
const isUsableViaTeam = (type) => teamEquipment.some((e) => e.category === type && e.status === "available");
```

Unavailable or maintenance-blocked equipment never satisfies a hard requirement — the spec's own Step 10 rule, enforced directly by this logic rather than a separate check.

## Scope limitation, disclosed honestly

Checkpoint 26's `Equipment` type has no capacity, warranty, or expiration field. The spec's own "Required capacity" and "expiration or warranty only when operationally relevant" language means those checks have nothing to evaluate here rather than being faked with invented data. `CapabilityRequirement.capacity_requirement` (how many distinct workers/resources a requirement needs, evaluated at the requirement level by [`capability-coverage.md`](capability-coverage.md)) is the real, already-modeled capacity concept this platform uses instead.

## Result shape

```ts
interface EquipmentCapabilityResult {
  satisfiedRequiredTypes: string[];
  missingRequiredTypes: string[];
  matchedPreferredTypes: string[];
  unmatchedPreferredTypes: string[];
}
```

`eligibilityEngine.ts` uses `missingRequiredTypes` to build `blockingReasons`/`unavailableResources`; `capabilityScoreEngine.ts`'s `computeEquipmentScore` uses the same four lists to compute the weighted required/preferred score — one evaluation function, two consumers, never duplicated logic.
