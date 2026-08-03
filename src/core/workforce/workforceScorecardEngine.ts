import type { Worker, Team, Assignment, Equipment, Vehicle, WorkforceScorecard, AvailabilitySummary, ExpiringCertification, MobileSession } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26, Step 13 — Workforce Scorecard. A single deterministic
 * arithmetic rollup over already-computed data, same discipline as
 * `scorecardEngine.ts` (Objectives)/`executiveScorecardEngine.ts` — no
 * scoring, no scheduling opinion, just counts.
 */
export interface ComputeWorkforceScorecardInput {
  workers: Worker[];
  teams: Team[];
  assignments: Assignment[];
  equipment: Equipment[];
  vehicles: Vehicle[];
  activeMobileSessions: MobileSession[];
  availabilitySummary: AvailabilitySummary;
  expiringCertifications: ExpiringCertification[];
  evaluatedAt: string;
}

export function computeWorkforceScorecard(input: ComputeWorkforceScorecardInput): WorkforceScorecard {
  return {
    totalWorkers: input.workers.length,
    activeWorkers: input.workers.filter((w) => w.status === "active").length,
    availableNow: input.availabilitySummary.available,
    onAssignmentNow: input.availabilitySummary.onAssignment,
    teamsCount: input.teams.filter((t) => t.status === "active").length,
    activeAssignments: input.assignments.filter((a) => a.status === "active").length,
    expiringCertificationsCount: input.expiringCertifications.length,
    equipmentInUse: input.equipment.filter((e) => e.status === "in_use").length,
    vehiclesInUse: input.vehicles.filter((v) => v.status === "in_use").length,
    activeMobileSessions: input.activeMobileSessions.length,
    evaluatedAt: input.evaluatedAt,
  };
}
