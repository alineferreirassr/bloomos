import type { RequirementEvaluationResult, WorkforceRisk, WorkforceRiskSeverity } from "@/types/capability";
import type { Worker, Equipment, Vehicle, Team } from "@/types/workforce";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 26.1, Step 20 — Workforce Risk Detection. Twelve named,
 * deterministic detectors over already-computed `RequirementEvaluationResult[]`
 * plus raw workforce data — no AI, no randomness, no new evaluation.
 */
export interface DetectWorkforceRisksInput {
  evaluationResults: RequirementEvaluationResult[];
  activeWorkers: Worker[];
  equipment: Equipment[];
  vehicles: Vehicle[];
  activeTeams: Team[];
  now: string;
}

function risk(type: WorkforceRisk["type"], severity: WorkforceRiskSeverity, description: string, related: Partial<Pick<WorkforceRisk, "relatedRequirementId" | "relatedWorkerId" | "relatedEquipmentId" | "relatedVehicleId">> = {}): WorkforceRisk {
  return {
    id: generateId("workforce_risk"),
    type,
    severity,
    description,
    relatedRequirementId: related.relatedRequirementId ?? null,
    relatedWorkerId: related.relatedWorkerId ?? null,
    relatedEquipmentId: related.relatedEquipmentId ?? null,
    relatedVehicleId: related.relatedVehicleId ?? null,
  };
}

export function detectWorkforceRisks(input: DetectWorkforceRisksInput): WorkforceRisk[] {
  const risks: WorkforceRisk[] = [];
  const singleWorkerDependencyCountByWorker = new Map<string, number>();

  for (const result of input.evaluationResults) {
    const rankable = result.ranking.filter((r) => r.rank !== null);
    const title = result.requirement.title;

    // 1. No eligible worker
    if (rankable.length === 0) {
      risks.push(risk("no_eligible_worker", "high", `No eligible or conditionally eligible worker for "${title}".`, { relatedRequirementId: result.requirement.id }));
    }

    // 2. Only one eligible worker
    if (rankable.length === 1) {
      const workerId = rankable[0].workerId;
      risks.push(risk("single_eligible_worker", "medium", `Only one worker qualifies for "${title}".`, { relatedRequirementId: result.requirement.id, relatedWorkerId: workerId }));
      singleWorkerDependencyCountByWorker.set(workerId, (singleWorkerDependencyCountByWorker.get(workerId) ?? 0) + 1);
    }

    // 3. All eligible workers currently unavailable — only checkable when the requirement actually constrains availability.
    if (result.requirement.required_availability_statuses.length > 0 && rankable.length > 0 && rankable.every((r) => r.scores.availabilityScore === 0)) {
      risks.push(risk("all_eligible_unavailable", "high", `Every qualified worker for "${title}" is currently unavailable.`, { relatedRequirementId: result.requirement.id }));
    }

    // 6/7. Missing equipment/vehicle coverage — a required type this whole workspace has zero available instances of.
    for (const type of result.requirement.required_equipment_types) {
      const hasAny = input.equipment.some((e) => e.category === type && e.status === "available");
      if (!hasAny) risks.push(risk("missing_equipment_coverage", "high", `No available equipment of type "${type}" for "${title}".`, { relatedRequirementId: result.requirement.id }));
    }
    for (const type of result.requirement.required_vehicle_types) {
      const hasAny = input.vehicles.some((v) => v.vehicle_type === type && v.status === "available");
      if (!hasAny) risks.push(risk("missing_vehicle_coverage", "high", `No available vehicle of type "${type}" for "${title}".`, { relatedRequirementId: result.requirement.id }));
    }
  }

  // 4/5. Certification expired / expiring soon — workspace-wide, not tied to any one requirement.
  const expiringSoonThresholdDays = 30;
  for (const worker of input.activeWorkers) {
    for (const cert of worker.certifications) {
      if (cert.expiration_date === null) continue;
      if (cert.expiration_date <= input.now) {
        risks.push(risk("expired_certification", "medium", `${worker.first_name} ${worker.last_name}'s "${cert.name}" certification has expired.`, { relatedWorkerId: worker.id }));
      } else {
        const daysUntilExpiration = Math.floor((new Date(cert.expiration_date).getTime() - new Date(input.now).getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilExpiration <= expiringSoonThresholdDays) {
          risks.push(risk("certification_expiring_soon", "low", `${worker.first_name} ${worker.last_name}'s "${cert.name}" certification expires in ${daysUntilExpiration} day(s).`, { relatedWorkerId: worker.id }));
        }
      }
    }
  }

  // 8. Team overreliance — every requirement with any qualified worker draws that worker from a single team, while more than one active team exists.
  if (input.activeTeams.length >= 2) {
    const workerTeamById = new Map(input.activeWorkers.map((w) => [w.id, w.team_id] as const));
    const requirementsWithEligible = input.evaluationResults.filter((r) => r.ranking.some((e) => e.rank !== null));
    for (const team of input.activeTeams) {
      const suppliedByThisTeam = requirementsWithEligible.filter((r) => r.ranking.some((e) => e.rank !== null && workerTeamById.get(e.workerId) === team.id));
      if (requirementsWithEligible.length > 0 && suppliedByThisTeam.length === requirementsWithEligible.length) {
        risks.push(risk("team_overreliance", "medium", `Team "${team.name}" is the sole source of qualified workers across every requirement with a qualified worker.`, { relatedRequirementId: null }));
      }
    }
  }

  // 9/10. Worker overreliance / critical capability overload — how many requirements a worker is the SOLE qualified person for.
  for (const [workerId, count] of singleWorkerDependencyCountByWorker) {
    if (count >= 3) risks.push(risk("worker_critical_capability_overload", "high", `This worker is the sole qualified worker for ${count} different requirements.`, { relatedWorkerId: workerId }));
    else if (count >= 2) risks.push(risk("worker_overreliance", "high", `This worker is the sole qualified worker for ${count} requirements.`, { relatedWorkerId: workerId }));
  }

  // 11/12. Equipment/vehicle single point of failure — exactly one available instance of a type some requirement actually needs.
  const requiredEquipmentTypes = new Set(input.evaluationResults.flatMap((r) => r.requirement.required_equipment_types));
  const requiredVehicleTypes = new Set(input.evaluationResults.flatMap((r) => r.requirement.required_vehicle_types));
  const availableEquipmentByType = new Map<string, Equipment[]>();
  for (const e of input.equipment.filter((e) => e.status === "available")) availableEquipmentByType.set(e.category, [...(availableEquipmentByType.get(e.category) ?? []), e]);
  for (const [type, items] of availableEquipmentByType) {
    if (items.length === 1 && requiredEquipmentTypes.has(type)) risks.push(risk("equipment_single_point_of_failure", "medium", `Only one available "${type}" equipment item exists.`, { relatedEquipmentId: items[0].id }));
  }
  const availableVehiclesByType = new Map<string, Vehicle[]>();
  for (const v of input.vehicles.filter((v) => v.status === "available")) availableVehiclesByType.set(v.vehicle_type, [...(availableVehiclesByType.get(v.vehicle_type) ?? []), v]);
  for (const [type, items] of availableVehiclesByType) {
    if (items.length === 1 && requiredVehicleTypes.has(type)) risks.push(risk("vehicle_single_point_of_failure", "medium", `Only one available "${type}" vehicle exists.`, { relatedVehicleId: items[0].id }));
  }

  return risks;
}
