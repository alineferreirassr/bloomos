import type { Equipment } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26.1, Step 10 — Equipment Capability. Evaluates a
 * requirement's `required_equipment_types`/`preferred_equipment_types`
 * against real `Equipment` rows (Checkpoint 26) — never a second
 * equipment registry.
 *
 * Scope note: this checkpoint's `Equipment` type (`types/workforce.ts`)
 * has no capacity/warranty/expiration field — the spec's own "Required
 * capacity" and "only when operationally relevant" language for
 * expiration/warranty means those checks simply have nothing to evaluate
 * here rather than being faked; `CapabilityRequirement.capacity_requirement`
 * (how many distinct workers/resources a requirement needs) is the real,
 * already-modeled capacity concept this platform uses instead — see
 * `docs/equipment-capabilities.md`.
 */
export interface EquipmentCapabilityResult {
  satisfiedRequiredTypes: string[];
  missingRequiredTypes: string[];
  matchedPreferredTypes: string[];
  unmatchedPreferredTypes: string[];
}

/** Equipment already assigned to the worker counts unless it's `maintenance`/`retired`; equipment pooled through the worker's team only counts while genuinely `available` — it would need to be reassigned, so a teammate already using it doesn't satisfy the requirement. Unavailable/maintenance-blocked equipment never satisfies a hard requirement (spec Step 10's own rule). */
export function evaluateEquipmentCapability(requiredTypes: string[], preferredTypes: string[], workerEquipment: Equipment[], teamEquipment: Equipment[]): EquipmentCapabilityResult {
  const isUsableByWorker = (type: string) => workerEquipment.some((e) => e.category === type && e.status !== "maintenance" && e.status !== "retired");
  const isUsableViaTeam = (type: string) => teamEquipment.some((e) => e.category === type && e.status === "available");
  const isSatisfied = (type: string) => isUsableByWorker(type) || isUsableViaTeam(type);

  const satisfiedRequiredTypes = requiredTypes.filter(isSatisfied);
  const missingRequiredTypes = requiredTypes.filter((t) => !isSatisfied(t));
  const matchedPreferredTypes = preferredTypes.filter(isSatisfied);
  const unmatchedPreferredTypes = preferredTypes.filter((t) => !isSatisfied(t));

  return { satisfiedRequiredTypes, missingRequiredTypes, matchedPreferredTypes, unmatchedPreferredTypes };
}
