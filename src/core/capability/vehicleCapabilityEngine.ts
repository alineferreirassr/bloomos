import type { Vehicle } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26.1, Step 11 — Vehicle Capability. Mirrors
 * `equipmentCapabilityEngine.ts` exactly, over `Vehicle.vehicle_type`
 * instead of `Equipment.category`.
 *
 * Scope note: this checkpoint's `Vehicle` type has no capacity/insurance/
 * mileage field. "Insurance validity" and "Required mileage constraints
 * only when explicitly configured" have nothing to evaluate honestly —
 * this codebase tracks no insurance record and `CapabilityRequirement`
 * has no mileage field to configure, so per the spec's own "only when
 * explicitly configured" escape hatch, these checks are correctly never
 * triggered rather than faked. See `docs/vehicle-capabilities.md`.
 */
export interface VehicleCapabilityResult {
  satisfiedRequiredTypes: string[];
  missingRequiredTypes: string[];
  matchedPreferredTypes: string[];
  unmatchedPreferredTypes: string[];
}

/** Same "already-assigned counts unless maintenance/retired, team-pooled only counts while genuinely available" rule as Equipment. Unavailable/non-operational vehicles never satisfy a hard requirement (spec Step 11's own rule). */
export function evaluateVehicleCapability(requiredTypes: string[], preferredTypes: string[], workerVehicle: Vehicle | null, teamVehicles: Vehicle[]): VehicleCapabilityResult {
  const isUsableByWorker = (type: string) => workerVehicle !== null && workerVehicle.vehicle_type === type && workerVehicle.status !== "maintenance" && workerVehicle.status !== "retired";
  const isUsableViaTeam = (type: string) => teamVehicles.some((v) => v.vehicle_type === type && v.status === "available");
  const isSatisfied = (type: string) => isUsableByWorker(type) || isUsableViaTeam(type);

  const satisfiedRequiredTypes = requiredTypes.filter(isSatisfied);
  const missingRequiredTypes = requiredTypes.filter((t) => !isSatisfied(t));
  const matchedPreferredTypes = preferredTypes.filter(isSatisfied);
  const unmatchedPreferredTypes = preferredTypes.filter((t) => !isSatisfied(t));

  return { satisfiedRequiredTypes, missingRequiredTypes, matchedPreferredTypes, unmatchedPreferredTypes };
}
