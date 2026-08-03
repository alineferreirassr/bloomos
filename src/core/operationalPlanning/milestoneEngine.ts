import type { Milestone } from "@/types/operationalPlanning";

/** v2.0 Checkpoint 27.2, Step 6 — Milestone Engine. Pure reads over a plan's own `milestones` array — progress tracking, never a live status transition (that's the module layer's job, via `operationalPlansStore.updatePlan`). */

export interface MilestoneProgress {
  total: number;
  completed: number;
  ratio: number;
}

/** Vacuous 100%-equivalent (`ratio: 1`) for a plan with zero milestones — same "not applicable resolves to a pass" discipline every score engine in this codebase follows. */
export function milestoneProgress(milestones: Milestone[]): MilestoneProgress {
  const completed = milestones.filter((m) => m.status === "completed").length;
  return { total: milestones.length, completed, ratio: milestones.length === 0 ? 1 : completed / milestones.length };
}

export function findBlockedMilestones(milestones: Milestone[]): Milestone[] {
  return milestones.filter((m) => m.status === "blocked");
}

export function findIncompleteMilestones(milestones: Milestone[]): Milestone[] {
  return milestones.filter((m) => m.status !== "completed");
}

/** A milestone whose `target_phase_id` doesn't resolve to a real phase in this plan. */
export function findOrphanedMilestones(milestones: Milestone[], realPhaseIds: ReadonlySet<string>): Milestone[] {
  return milestones.filter((m) => m.target_phase_id !== null && !realPhaseIds.has(m.target_phase_id));
}
