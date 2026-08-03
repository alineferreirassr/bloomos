# Vehicle Capability Engine

v2.0 Checkpoint 26.1, Step 11. `core/capability/vehicleCapabilityEngine.ts`'s `evaluateVehicleCapability(requiredTypes, preferredTypes, workerVehicle, teamVehicles)` — mirrors [`equipment-capabilities.md`](equipment-capabilities.md) exactly, over `Vehicle.vehicle_type` instead of `Equipment.category`.

## The same two-path rule

- The worker's own assigned vehicle satisfies a type unless it's `maintenance` or `retired`.
- A team-pooled vehicle only counts while `available`.

```ts
const isUsableByWorker = (type) => workerVehicle !== null && workerVehicle.vehicle_type === type && workerVehicle.status !== "maintenance" && workerVehicle.status !== "retired";
const isUsableViaTeam = (type) => teamVehicles.some((v) => v.vehicle_type === type && v.status === "available");
```

Unavailable or non-operational vehicles never satisfy a hard requirement — the spec's own Step 11 rule.

## `vehicle_type` — a small, disclosed additive field

Checkpoint 26's `Vehicle` type had `make`/`model`/`year`/`license_plate` but no categorical "type" (van, truck, sedan). Without it, `required_vehicle_types` would have nothing real to match against. `vehicle_type: string` was added, mirroring `Equipment.category`'s "required, freeform category" convention exactly — see `docs/workforce-capabilities.md`'s additive-extensions section for the full blast-radius disclosure (`CreateVehicleInput` gained the field as required, matching Equipment's own precedent).

## Two more scope limitations, disclosed honestly

- **Insurance validity** (Step 11) — this codebase tracks no insurance record type anywhere; there is nothing to evaluate honestly, so this check is never triggered rather than faked.
- **Required mileage constraints "only when explicitly configured"** — `CapabilityRequirement` has no mileage field to configure. Per the spec's own escape hatch, nothing ever configures it, so nothing ever evaluates it. This required no code — the absence of the field *is* the honest implementation of "only when explicitly configured."

## Reused by the same two consumers

`eligibilityEngine.ts` (blocking/`unavailableResources`) and `capabilityScoreEngine.ts`'s `computeVehicleScore` (weighted required/preferred score) both call this single function — never duplicated logic.
