import type { Worker, Team, ExpiringCertification } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26, Step 5 — Skills Engine. Pure functions over
 * already-fetched `Worker` records — skills/certifications live directly
 * on `Worker` (`types/workforce.ts`), never a second registry.
 */

export interface WorkerSkillsSummary {
  workerId: string;
  primarySkillNames: string[];
  secondarySkillNames: string[];
  learningSkillNames: string[];
  expiredCertificationCount: number;
}

function daysBetween(fromIso: string, toIso: string): number {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export function summarizeWorkerSkills(worker: Worker, now: string): WorkerSkillsSummary {
  return {
    workerId: worker.id,
    primarySkillNames: worker.skills.filter((s) => s.level === "primary").map((s) => s.name),
    secondarySkillNames: worker.skills.filter((s) => s.level === "secondary").map((s) => s.name),
    learningSkillNames: worker.skills.filter((s) => s.level === "learning").map((s) => s.name),
    expiredCertificationCount: worker.certifications.filter((c) => c.expiration_date !== null && c.expiration_date <= now).length,
  };
}

/** A certification with `expiration_date: null` never expires and is never returned here. `withinDays` is inclusive of already-expired certifications (negative `daysUntilExpiration`) so a caller can distinguish "expiring soon" from "already expired" without a second pass. */
export function findExpiringCertifications(workers: Worker[], withinDays: number, now: string): ExpiringCertification[] {
  const results: ExpiringCertification[] = [];
  for (const worker of workers) {
    for (const certification of worker.certifications) {
      if (certification.expiration_date === null) continue;
      const daysUntilExpiration = daysBetween(now, certification.expiration_date);
      if (daysUntilExpiration <= withinDays) {
        results.push({ workerId: worker.id, workerName: `${worker.first_name} ${worker.last_name}`, certification, daysUntilExpiration });
      }
    }
  }
  return results.sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);
}

export interface TeamSkillCoverage {
  teamId: string;
  /** Union of every member's skill names, deduplicated — "what this team can do collectively," not a per-member breakdown. */
  coveredSkillNames: string[];
  primarySkillCoverageCount: Record<string, number>;
}

export function computeTeamSkillCoverage(team: Team, workers: Worker[]): TeamSkillCoverage {
  const members = workers.filter((w) => team.member_worker_ids.includes(w.id));
  const coveredSkillNames = new Set<string>();
  const primarySkillCoverageCount: Record<string, number> = {};

  for (const member of members) {
    for (const skill of member.skills) {
      coveredSkillNames.add(skill.name);
      if (skill.level === "primary") primarySkillCoverageCount[skill.name] = (primarySkillCoverageCount[skill.name] ?? 0) + 1;
    }
  }

  return { teamId: team.id, coveredSkillNames: Array.from(coveredSkillNames).sort(), primarySkillCoverageCount };
}
