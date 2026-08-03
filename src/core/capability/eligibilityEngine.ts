import type { CapabilityRequirement, CapabilityEligibility, CapabilityBlockingReason, CapabilityPreferenceMatch, EligibilityState, CapabilityCustomRule } from "@/types/capability";
import type { Worker, Assignment, Equipment, Vehicle, LocationSnapshot, AvailabilityStatus, ExperienceLevel } from "@/types/workforce";
import { EXPERIENCE_LEVELS as EXPERIENCE_LEVEL_ORDER } from "@/types/workforce";
import { evaluateCertificationCapability, isCertificationStateBlocking } from "@/core/capability/certificationCapabilityEngine";
import { evaluateEquipmentCapability } from "@/core/capability/equipmentCapabilityEngine";
import { evaluateVehicleCapability } from "@/core/capability/vehicleCapabilityEngine";
import { computeDistanceToRequirement, isWithinMaximumDistance } from "@/core/capability/locationCompatibilityEngine";
import { detectWorkerAssignmentConflict } from "@/core/capability/assignmentConflictEngine";

/**
 * v2.0 Checkpoint 26.1, Steps 3-5 — the Eligibility Engine. Strict and
 * deterministic: every hard requirement check either passes or produces
 * a `CapabilityBlockingReason` naming the exact rule; every soft
 * preference only ever contributes to `matchedPreferences`/
 * `unmatchedPreferences`, never to `blockingReasons`. No randomness, no
 * AI — every branch below is a disclosed comparison against
 * already-fetched Checkpoint 26 data.
 */
export interface EligibilityContext {
  worker: Worker;
  currentAvailability: AvailabilityStatus;
  /** Every active `Assignment` in the workspace — needed for conflict + team-capacity checks, not just this worker's own. */
  allActiveAssignments: Assignment[];
  workerEquipment: Equipment[];
  teamEquipment: Equipment[];
  workerVehicle: Vehicle | null;
  teamVehicles: Vehicle[];
  workerLocation: LocationSnapshot | null;
  now: string;
  expiringSoonThresholdDays: number;
}

/** Context types that share a name with a real `AssignableType` (`types/workforce.ts`) — the only ones a Conflicting Assignment check can honestly run against. `asset` maps context-wise the same way it maps in `ASSIGNABLE_TYPE_TO_NODE_TYPE`. */
const ASSIGNMENT_CONFLICT_CONTEXT_TYPES = new Set(["event", "client", "asset", "vehicle", "equipment", "vendor"]);

function experienceLevelRank(level: ExperienceLevel): number {
  return EXPERIENCE_LEVEL_ORDER.indexOf(level);
}

function evaluateCustomRule(rule: CapabilityCustomRule, worker: Worker): boolean {
  const fieldValue: string | null =
    rule.field === "worker_role" ? worker.role : rule.field === "employment_type" ? worker.employment_type : rule.field === "team_id" ? worker.team_id : rule.field === "experience_level" ? worker.experience_level : worker.status;

  if (rule.operator === "equals") return fieldValue === rule.value;
  if (rule.operator === "not_equals") return fieldValue !== rule.value;
  const values = Array.isArray(rule.value) ? rule.value : [rule.value];
  if (rule.operator === "in") return fieldValue !== null && values.includes(fieldValue);
  return fieldValue === null || !values.includes(fieldValue);
}

export function evaluateEligibility(requirement: CapabilityRequirement, context: EligibilityContext): CapabilityEligibility {
  const { worker } = context;
  const blockingReasons: CapabilityBlockingReason[] = [];
  const satisfiedHardRequirements: string[] = [];
  const unsatisfiedHardRequirements: string[] = [];
  const matchedPreferences: CapabilityPreferenceMatch[] = [];
  const unmatchedPreferences: CapabilityPreferenceMatch[] = [];
  const expiringSoonCertifications: string[] = [];
  const unavailableResources: string[] = [];
  const fallbacksUsed: string[] = [];
  let isUnknown = false;

  function block(rule: string, detail: string): void {
    blockingReasons.push({ rule, detail });
    unsatisfiedHardRequirements.push(rule);
  }
  function pass(rule: string): void {
    satisfiedHardRequirements.push(rule);
  }
  function preference(rule: string, detail: string, matched: boolean): void {
    (matched ? matchedPreferences : unmatchedPreferences).push({ rule, detail, matched });
  }

  // 1. Worker Active Status / Employment Status
  if (worker.status === "active") pass("worker_status");
  else block("worker_status", `Worker status is "${worker.status}", not active.`);

  if (requirement.required_employment_types.length > 0) {
    if (requirement.required_employment_types.includes(worker.employment_type)) pass("employment_type");
    else block("employment_type", `Worker employment type "${worker.employment_type}" is not one of the required types.`);
  }

  // 2. Availability
  if (requirement.required_availability_statuses.length > 0) {
    if (requirement.required_availability_statuses.includes(context.currentAvailability)) pass("availability");
    else block("availability", `Worker's current availability ("${context.currentAvailability}") does not match a required status.`);
  }

  // 3. Required Skills / Preferred Skills
  const workerSkillNames = new Set(worker.skills.map((s) => s.name));
  for (const skill of requirement.required_skills) {
    if (workerSkillNames.has(skill)) pass(`required_skill:${skill}`);
    else block(`required_skill:${skill}`, `Missing required skill "${skill}".`);
  }
  for (const skill of requirement.preferred_skills) preference(`preferred_skill:${skill}`, `Preferred skill "${skill}".`, workerSkillNames.has(skill));

  // 4. Required Certifications / Preferred Certifications
  for (const certName of requirement.required_certifications) {
    const result = evaluateCertificationCapability(certName, worker.certifications, context.now, requirement.required_valid_through_date, context.expiringSoonThresholdDays);
    if (result.state === "expiring_soon") expiringSoonCertifications.push(certName);
    if (isCertificationStateBlocking(result.state)) block(`required_certification:${certName}`, `Certification "${certName}" is ${result.state.replace(/_/g, " ")}.`);
    else pass(`required_certification:${certName}`);
  }
  for (const certName of requirement.preferred_certifications) {
    const result = evaluateCertificationCapability(certName, worker.certifications, context.now, requirement.required_valid_through_date, context.expiringSoonThresholdDays);
    preference(`preferred_certification:${certName}`, `Preferred certification "${certName}" is ${result.state.replace(/_/g, " ")}.`, !isCertificationStateBlocking(result.state));
  }

  // 5. Required Languages / Preferred Languages
  for (const language of requirement.required_languages) {
    if (worker.languages.includes(language)) pass(`required_language:${language}`);
    else block(`required_language:${language}`, `Worker does not speak the required language "${language}".`);
  }
  for (const language of requirement.preferred_languages) preference(`preferred_language:${language}`, `Preferred language "${language}".`, worker.languages.includes(language));

  // 6. Minimum / Preferred Experience Level
  if (requirement.minimum_experience_level !== null) {
    if (experienceLevelRank(worker.experience_level) >= experienceLevelRank(requirement.minimum_experience_level)) pass("minimum_experience_level");
    else block("minimum_experience_level", `Worker experience level "${worker.experience_level}" is below the required "${requirement.minimum_experience_level}".`);
  }
  if (requirement.preferred_experience_level !== null) {
    preference("preferred_experience_level", `Preferred experience level "${requirement.preferred_experience_level}".`, experienceLevelRank(worker.experience_level) >= experienceLevelRank(requirement.preferred_experience_level));
  }

  // 7. Required Equipment / Preferred Equipment
  const equipmentResult = evaluateEquipmentCapability(requirement.required_equipment_types, requirement.preferred_equipment_types, context.workerEquipment, context.teamEquipment);
  for (const type of equipmentResult.satisfiedRequiredTypes) pass(`required_equipment:${type}`);
  for (const type of equipmentResult.missingRequiredTypes) {
    block(`required_equipment:${type}`, `No available equipment of type "${type}".`);
    unavailableResources.push(`equipment:${type}`);
  }
  for (const type of equipmentResult.matchedPreferredTypes) preference(`preferred_equipment:${type}`, `Preferred equipment type "${type}" available.`, true);
  for (const type of equipmentResult.unmatchedPreferredTypes) preference(`preferred_equipment:${type}`, `Preferred equipment type "${type}" not available.`, false);

  // 8. Required Vehicle / Preferred Vehicle
  const vehicleResult = evaluateVehicleCapability(requirement.required_vehicle_types, requirement.preferred_vehicle_types, context.workerVehicle, context.teamVehicles);
  for (const type of vehicleResult.satisfiedRequiredTypes) pass(`required_vehicle:${type}`);
  for (const type of vehicleResult.missingRequiredTypes) {
    block(`required_vehicle:${type}`, `No available vehicle of type "${type}".`);
    unavailableResources.push(`vehicle:${type}`);
  }
  for (const type of vehicleResult.matchedPreferredTypes) preference(`preferred_vehicle:${type}`, `Preferred vehicle type "${type}" available.`, true);
  for (const type of vehicleResult.unmatchedPreferredTypes) preference(`preferred_vehicle:${type}`, `Preferred vehicle type "${type}" not available.`, false);

  // 9. Team Requirement / Preferred Team
  if (requirement.required_team_id !== null) {
    if (worker.team_id === requirement.required_team_id) pass("required_team");
    else block("required_team", `Worker does not belong to the required team.`);
  }
  if (requirement.preferred_team_id !== null) preference("preferred_team", "Preferred team membership.", worker.team_id === requirement.preferred_team_id);

  // 10. Excluded Worker / Excluded Team
  if (requirement.excluded_worker_ids.includes(worker.id)) block("excluded_worker", "This worker is explicitly excluded from this requirement.");
  else pass("excluded_worker");
  if (worker.team_id !== null && requirement.excluded_team_ids.includes(worker.team_id)) block("excluded_team", "This worker's team is explicitly excluded from this requirement.");
  else pass("excluded_team");

  // 11. Location Requirement / Distance Limit
  if (requirement.location_requirement !== null || requirement.maximum_distance_km !== null) {
    const distance = computeDistanceToRequirement(context.workerLocation, requirement.location_requirement);
    const withinRange = isWithinMaximumDistance(distance, requirement.maximum_distance_km);
    if (distance.kind === "unknown") {
      fallbacksUsed.push(`distance:unknown (${distance.reason})`);
      if (withinRange === null) isUnknown = true;
    } else if (withinRange === false) {
      block("maximum_distance", `Distance (${distance.distanceKm!.toFixed(1)}km) exceeds the maximum of ${requirement.maximum_distance_km}km.`);
    } else {
      pass("maximum_distance");
    }
  }

  // 12. Conflicting Assignments — only meaningful when this requirement's
  // context type is also a real `AssignableType` (`types/workforce.ts`);
  // `team`/`workspace`/`project_placeholder` contexts have no matching
  // Assignment concept to conflict against.
  if (requirement.context !== null && ASSIGNMENT_CONFLICT_CONTEXT_TYPES.has(requirement.context_type)) {
    const conflict = detectWorkerAssignmentConflict(worker.id, requirement.context_type, requirement.context.nodeId, context.allActiveAssignments);
    if (conflict.hasDuplicateAssignment) block("conflicting_assignment", "Worker already has an active assignment to this exact target.");
    else pass("conflicting_assignment");
  }

  // 13. Custom Deterministic Rules
  for (const rule of requirement.custom_rules) {
    if (evaluateCustomRule(rule, worker)) pass(`custom_rule:${rule.id}`);
    else block(`custom_rule:${rule.id}`, rule.description);
  }

  // Unmatched *preferences* never affect eligibility state — only ranking/score (spec Step 5's own rule). "conditionally_eligible" reflects a real caveat on an otherwise-eligible worker: an expiring-soon certification.
  const state: EligibilityState = blockingReasons.length > 0 ? "ineligible" : isUnknown ? "unknown" : expiringSoonCertifications.length > 0 ? "conditionally_eligible" : "eligible";

  return {
    requirementId: requirement.id,
    workerId: worker.id,
    state,
    blockingReasons,
    satisfiedHardRequirements,
    unsatisfiedHardRequirements,
    matchedPreferences,
    unmatchedPreferences,
    expiringSoonCertifications,
    unavailableResources,
    fallbacksUsed,
    evaluatedAt: context.now,
  };
}
