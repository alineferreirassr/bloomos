import type { RequirementEvaluationResult, CapabilityCoverageReport, RequirementCoverageEntry, SingleWorkerDependency } from "@/types/capability";
import type { Worker, Team, Equipment, Vehicle } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26.1, Step 19 — Capability Coverage Engine. A pure
 * workspace-level rollup over already-computed `RequirementEvaluationResult[]`
 * (from `capabilityActions.ts` running `EligibilityEngine`/`CapabilityScoreEngine`
 * per requirement) plus the raw Worker/Team/Equipment/Vehicle rows — no
 * new evaluation happens here, only aggregation.
 */
export interface ComputeCapabilityCoverageInput {
  workspaceId: string;
  activeWorkers: Worker[];
  availableWorkerCount: number;
  activeTeams: Team[];
  equipment: Equipment[];
  vehicles: Vehicle[];
  evaluationResults: RequirementEvaluationResult[];
  now: string;
}

/** Only counts a certification as "covered" while it's genuinely usable right now (verified, not expired) — a revoked or lapsed certification doesn't represent real coverage. */
function computeCertificationCoverage(workers: Worker[], now: string): Record<string, number> {
  const coverage: Record<string, number> = {};
  for (const worker of workers) {
    for (const cert of worker.certifications) {
      if (!cert.verified) continue;
      if (cert.expiration_date !== null && cert.expiration_date <= now) continue;
      coverage[cert.name] = (coverage[cert.name] ?? 0) + 1;
    }
  }
  return coverage;
}

function tally<T>(items: T[], keyOf: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = keyOf(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

export function computeCapabilityCoverage(input: ComputeCapabilityCoverageInput): CapabilityCoverageReport {
  const skillsCoverage: Record<string, number> = {};
  const languageCoverage: Record<string, number> = {};
  for (const worker of input.activeWorkers) {
    for (const skill of worker.skills) skillsCoverage[skill.name] = (skillsCoverage[skill.name] ?? 0) + 1;
    for (const language of worker.languages) languageCoverage[language] = (languageCoverage[language] ?? 0) + 1;
  }

  const equipmentCoverage = tally(
    input.equipment.filter((e) => e.status === "available"),
    (e) => e.category,
  );
  const vehicleCoverage = tally(
    input.vehicles.filter((v) => v.status === "available"),
    (v) => v.vehicle_type,
  );

  const requirementCoverage: RequirementCoverageEntry[] = input.evaluationResults.map((result) => {
    const totalCovering = result.eligibleCount + result.conditionallyEligibleCount;
    const capacityNeeded = result.requirement.capacity_requirement ?? 1;
    return {
      requirementId: result.requirement.id,
      eligibleCount: result.eligibleCount,
      conditionallyEligibleCount: result.conditionallyEligibleCount,
      capacityRequirement: result.requirement.capacity_requirement,
      meetsCapacity: totalCovering >= capacityNeeded,
    };
  });

  const uncoveredRequirementIds = requirementCoverage.filter((r) => !r.meetsCapacity).map((r) => r.requirementId);

  const singleWorkerDependencies: SingleWorkerDependency[] = [];
  for (const result of input.evaluationResults) {
    const rankable = result.ranking.filter((r) => r.rank !== null);
    if (rankable.length === 1) singleWorkerDependencies.push({ requirementId: result.requirement.id, workerId: rankable[0].workerId });
  }

  const requiredEquipmentTypes = new Set(input.evaluationResults.flatMap((r) => r.requirement.required_equipment_types));
  const requiredVehicleTypes = new Set(input.evaluationResults.flatMap((r) => r.requirement.required_vehicle_types));
  const singleEquipmentDependencies = Object.entries(equipmentCoverage)
    .filter(([category, count]) => count === 1 && requiredEquipmentTypes.has(category))
    .map(([category]) => category);
  const singleVehicleDependencies = Object.entries(vehicleCoverage)
    .filter(([type, count]) => count === 1 && requiredVehicleTypes.has(type))
    .map(([type]) => type);

  return {
    workspace_id: input.workspaceId,
    skillsCoverage,
    certificationCoverage: computeCertificationCoverage(input.activeWorkers, input.now),
    languageCoverage,
    equipmentCoverage,
    vehicleCoverage,
    availableWorkersCount: input.availableWorkerCount,
    activeTeamsCount: input.activeTeams.length,
    requirementCoverage,
    uncoveredRequirementIds,
    singleWorkerDependencies,
    singleEquipmentDependencies,
    singleVehicleDependencies,
    highRiskGapsCount: uncoveredRequirementIds.length + singleWorkerDependencies.length + singleEquipmentDependencies.length + singleVehicleDependencies.length,
    evaluatedAt: input.now,
  };
}
