import type { CapabilityRequirement, CapabilityEligibility, CapabilityScores, DistanceResult } from "@/types/capability";
import type { Worker, ExperienceLevel, LocationSnapshot, AvailabilityStatus, Equipment, Vehicle } from "@/types/workforce";
import { EXPERIENCE_LEVELS } from "@/types/workforce";
import { evaluateCertificationCapability } from "@/core/capability/certificationCapabilityEngine";
import { evaluateEquipmentCapability, type EquipmentCapabilityResult } from "@/core/capability/equipmentCapabilityEngine";
import { evaluateVehicleCapability, type VehicleCapabilityResult } from "@/core/capability/vehicleCapabilityEngine";
import { computeDistanceToRequirement } from "@/core/capability/locationCompatibilityEngine";

/**
 * v2.0 Checkpoint 26.1, Step 6 — Capability Score Engine. Every score is
 * 0-100, higher is always better, and every formula is a disclosed,
 * deterministic arithmetic expression over already-computed data — no
 * AI, no randomness. **Not applicable resolves to 100, never 0**: when a
 * requirement doesn't constrain a dimension at all (e.g. no
 * `required_skills`/`preferred_skills`), that dimension is vacuously
 * satisfied — scoring it `0` would misrepresent "this requirement never
 * asked" as "this worker completely failed," which is exactly the
 * "never silently invent a worst-case" discipline this checkpoint series
 * has held throughout (see `priority-engine.md`'s own fallback rule from
 * Checkpoint 25.7).
 */

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function weightedRequiredPreferred(requiredTotal: number, requiredSatisfied: number, preferredTotal: number, preferredSatisfied: number): number {
  if (requiredTotal === 0 && preferredTotal === 0) return 100;
  const requiredScore = requiredTotal === 0 ? 100 : (requiredSatisfied / requiredTotal) * 100;
  const preferredScore = preferredTotal === 0 ? 100 : (preferredSatisfied / preferredTotal) * 100;
  // Required weighs more than preferred — a hard-requirement shortfall should move the score more than a missed nice-to-have.
  return requiredTotal === 0 ? preferredScore : preferredTotal === 0 ? requiredScore : requiredScore * 0.7 + preferredScore * 0.3;
}

function experienceLevelRank(level: ExperienceLevel): number {
  return EXPERIENCE_LEVELS.indexOf(level);
}

export function computeEligibilityScore(eligibility: CapabilityEligibility): number {
  switch (eligibility.state) {
    case "eligible":
      return 100;
    case "conditionally_eligible":
      return 75;
    case "unknown":
      return 50;
    case "ineligible":
      return 0;
  }
}

export function computeSkillsMatchScore(requirement: CapabilityRequirement, worker: Worker): number {
  const workerSkillNames = new Set(worker.skills.map((s) => s.name));
  const requiredSatisfied = requirement.required_skills.filter((s) => workerSkillNames.has(s)).length;
  const preferredSatisfied = requirement.preferred_skills.filter((s) => workerSkillNames.has(s)).length;
  return weightedRequiredPreferred(requirement.required_skills.length, requiredSatisfied, requirement.preferred_skills.length, preferredSatisfied);
}

/** `"valid"` counts as fully satisfied; `"expiring_soon"` counts as 75% satisfied (a real caveat, but not a failure) — everything else (missing/expired/unverified) counts as 0. */
export function computeCertificationScore(requirement: CapabilityRequirement, worker: Worker, now: string): number {
  const stateCredit = (name: string): number => {
    const result = evaluateCertificationCapability(name, worker.certifications, now, requirement.required_valid_through_date);
    if (result.state === "valid") return 1;
    if (result.state === "expiring_soon") return 0.75;
    return 0;
  };

  const requiredTotal = requirement.required_certifications.length;
  const preferredTotal = requirement.preferred_certifications.length;
  const requiredCredit = requirement.required_certifications.reduce((sum, name) => sum + stateCredit(name), 0);
  const preferredCredit = requirement.preferred_certifications.reduce((sum, name) => sum + stateCredit(name), 0);

  if (requiredTotal === 0 && preferredTotal === 0) return 100;
  const requiredScore = requiredTotal === 0 ? 100 : (requiredCredit / requiredTotal) * 100;
  const preferredScore = preferredTotal === 0 ? 100 : (preferredCredit / preferredTotal) * 100;
  return requiredTotal === 0 ? preferredScore : preferredTotal === 0 ? requiredScore : requiredScore * 0.7 + preferredScore * 0.3;
}

/** A hard `minimum_experience_level` the worker doesn't meet scores `0` — consistent with that already being an eligibility-blocking failure. Meeting or exceeding a `preferred_experience_level` scores `100`; falling short of it loses 20 points per level of shortfall, floored at 40 (a real gap, but never treated as a hard failure). */
export function computeExperienceScore(requirement: CapabilityRequirement, worker: Worker): number {
  if (requirement.minimum_experience_level === null && requirement.preferred_experience_level === null) return 100;

  const workerRank = experienceLevelRank(worker.experience_level);
  if (requirement.minimum_experience_level !== null && workerRank < experienceLevelRank(requirement.minimum_experience_level)) return 0;
  if (requirement.preferred_experience_level === null) return 100;

  const shortfall = Math.max(0, experienceLevelRank(requirement.preferred_experience_level) - workerRank);
  return clamp(100 - shortfall * 20, 40, 100);
}

export function computeLanguageScore(requirement: CapabilityRequirement, worker: Worker): number {
  const requiredSatisfied = requirement.required_languages.filter((l) => worker.languages.includes(l)).length;
  const preferredSatisfied = requirement.preferred_languages.filter((l) => worker.languages.includes(l)).length;
  return weightedRequiredPreferred(requirement.required_languages.length, requiredSatisfied, requirement.preferred_languages.length, preferredSatisfied);
}

export function computeAvailabilityScore(requirement: CapabilityRequirement, currentAvailability: AvailabilityStatus): number {
  if (requirement.required_availability_statuses.length === 0) return 100;
  return requirement.required_availability_statuses.includes(currentAvailability) ? 100 : 0;
}

function resourceScore(requiredTotal: number, requiredSatisfied: number, preferredTotal: number, preferredSatisfied: number): number {
  return weightedRequiredPreferred(requiredTotal, requiredSatisfied, preferredTotal, preferredSatisfied);
}

export function computeEquipmentScore(requirement: CapabilityRequirement, result: EquipmentCapabilityResult): number {
  return resourceScore(requirement.required_equipment_types.length, result.satisfiedRequiredTypes.length, requirement.preferred_equipment_types.length, result.matchedPreferredTypes.length);
}

export function computeVehicleScore(requirement: CapabilityRequirement, result: VehicleCapabilityResult): number {
  return resourceScore(requirement.required_vehicle_types.length, result.satisfiedRequiredTypes.length, requirement.preferred_vehicle_types.length, result.matchedPreferredTypes.length);
}

/**
 * `distance:unknown` resolves to the documented neutral midpoint (50),
 * never 0 and never 100 — the same "unknown is genuinely unknown, not a
 * best or worst case" discipline `locationCompatibilityEngine.ts`
 * already applies to `DistanceResult`. When a `maximum_distance_km` is
 * configured, score decays linearly to 0 at the limit; without one, it
 * decays 1 point per km, floored at 0 — closer always scores higher.
 */
export function computeLocationScore(requirement: CapabilityRequirement, distance: DistanceResult): number {
  if (requirement.location_requirement === null && requirement.maximum_distance_km === null) return 100;
  if (distance.kind === "unknown") return 50;

  const distanceKm = distance.distanceKm!;
  if (requirement.maximum_distance_km !== null) return clamp(100 - (distanceKm / requirement.maximum_distance_km) * 100);
  return clamp(100 - distanceKm);
}

export function computeTeamFitScore(requirement: CapabilityRequirement, worker: Worker): number {
  if (requirement.required_team_id === null && requirement.preferred_team_id === null) return 100;
  if (requirement.required_team_id !== null) return worker.team_id === requirement.required_team_id ? 100 : 0;
  return worker.team_id === requirement.preferred_team_id ? 100 : 60;
}

/** Reflects how much room the worker has to take on more work right now — fewer existing active assignments scores higher. Not itself a hard gate; this checkpoint has no configured per-worker assignment limit. */
export function computeCapacityScore(workerActiveAssignmentCount: number): number {
  return clamp(100 - workerActiveAssignmentCount * 20);
}

export function computePreferenceScore(eligibility: CapabilityEligibility): number {
  const total = eligibility.matchedPreferences.length + eligibility.unmatchedPreferences.length;
  if (total === 0) return 100;
  return (eligibility.matchedPreferences.length / total) * 100;
}

/**
 * The composite. Weights sum to 1.0, documented here rather than
 * scattered: eligibility 0.25 (dominant — an ineligible/unknown worker
 * should never outrank an eligible one on overall score alone),
 * skills 0.15, certification 0.15, availability 0.10, experience 0.08,
 * language 0.05, equipment 0.05, vehicle 0.05, location 0.05,
 * capacity 0.03, teamFit 0.02, preference 0.02.
 */
const SCORE_WEIGHTS = {
  eligibilityScore: 0.25,
  skillsMatchScore: 0.15,
  certificationScore: 0.15,
  availabilityScore: 0.1,
  experienceScore: 0.08,
  languageScore: 0.05,
  equipmentScore: 0.05,
  vehicleScore: 0.05,
  locationScore: 0.05,
  capacityScore: 0.03,
  teamFitScore: 0.02,
  preferenceScore: 0.02,
} as const;

export interface ComputeCapabilityScoresInput {
  requirement: CapabilityRequirement;
  worker: Worker;
  eligibility: CapabilityEligibility;
  currentAvailability: AvailabilityStatus;
  workerEquipment: Equipment[];
  teamEquipment: Equipment[];
  workerVehicle: Vehicle | null;
  teamVehicles: Vehicle[];
  workerLocation: LocationSnapshot | null;
  workerActiveAssignmentCount: number;
  now: string;
}

export function computeCapabilityScores(input: ComputeCapabilityScoresInput): CapabilityScores {
  const { requirement, worker } = input;
  const equipmentResult = evaluateEquipmentCapability(requirement.required_equipment_types, requirement.preferred_equipment_types, input.workerEquipment, input.teamEquipment);
  const vehicleResult = evaluateVehicleCapability(requirement.required_vehicle_types, requirement.preferred_vehicle_types, input.workerVehicle, input.teamVehicles);
  const distance = computeDistanceToRequirement(input.workerLocation, requirement.location_requirement);

  const scores = {
    eligibilityScore: computeEligibilityScore(input.eligibility),
    skillsMatchScore: computeSkillsMatchScore(requirement, worker),
    certificationScore: computeCertificationScore(requirement, worker, input.now),
    experienceScore: computeExperienceScore(requirement, worker),
    languageScore: computeLanguageScore(requirement, worker),
    availabilityScore: computeAvailabilityScore(requirement, input.currentAvailability),
    equipmentScore: computeEquipmentScore(requirement, equipmentResult),
    vehicleScore: computeVehicleScore(requirement, vehicleResult),
    locationScore: computeLocationScore(requirement, distance),
    teamFitScore: computeTeamFitScore(requirement, worker),
    capacityScore: computeCapacityScore(input.workerActiveAssignmentCount),
    preferenceScore: computePreferenceScore(input.eligibility),
  };

  const overallCapabilityScore = Math.round((Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[]).reduce((sum, key) => sum + scores[key] * SCORE_WEIGHTS[key], 0));

  return { requirementId: requirement.id, workerId: worker.id, ...scores, overallCapabilityScore: clamp(overallCapabilityScore) };
}
