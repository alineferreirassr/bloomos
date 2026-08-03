import type { ExecutionPhase, Milestone, Deliverable, PlanChecklist } from "@/types/operationalPlanning";
import type { ExecutionSession, OperationalProgress } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 8 — Operational Progress Engine. Reads the
 * frozen Execution Package snapshot's own `ExecutionPhase[]`/`Milestone[]`/
 * `Deliverable[]`/`PlanChecklist[]` (reused directly, never re-derived)
 * alongside the session's own live completion overlays — the plan's own
 * frozen statuses never change; real execution progress lives here
 * instead. "Evidence Progress Placeholder" is always `null` — the
 * Stop Condition forbids evidence capture, so there is nothing to track.
 */

export interface ComputeOperationalProgressInput {
  phases: ExecutionPhase[];
  milestones: Milestone[];
  deliverables: Deliverable[];
  checklists: PlanChecklist[];
  session: Pick<ExecutionSession, "current_phase_id" | "completed_step_ids" | "completed_milestone_ids" | "completed_checklist_item_ids" | "completed_deliverable_ids">;
}

/** Only consulted when the session hasn't set an explicit `current_phase_id` yet — the first ordered phase with any incomplete step, or the last phase once everything is done. */
function deriveCurrentPhaseId(phases: ExecutionPhase[], completedStepIds: string[]): string | null {
  const sorted = [...phases].sort((a, b) => a.order - b.order);
  for (const phase of sorted) {
    if (phase.steps.some((s) => !completedStepIds.includes(s.id))) return phase.id;
  }
  return sorted.length > 0 ? sorted[sorted.length - 1].id : null;
}

function ratio(completed: number, total: number): number {
  return total === 0 ? 100 : Math.round((completed / total) * 100);
}

export function computeOperationalProgress(input: ComputeOperationalProgressInput): OperationalProgress {
  const allSteps = input.phases.flatMap((p) => p.steps);
  const completedStepIds = allSteps.filter((s) => input.session.completed_step_ids.includes(s.id)).map((s) => s.id);
  const remainingStepIds = allSteps.filter((s) => !input.session.completed_step_ids.includes(s.id)).map((s) => s.id);

  const completedMilestoneIds = input.milestones.filter((m) => input.session.completed_milestone_ids.includes(m.id)).map((m) => m.id);
  const pendingMilestoneIds = input.milestones.filter((m) => !input.session.completed_milestone_ids.includes(m.id)).map((m) => m.id);

  const allChecklistItems = input.checklists.flatMap((c) => c.items);
  const completedChecklistItemCount = allChecklistItems.filter((item) => input.session.completed_checklist_item_ids.includes(item.id)).length;
  const checklistProgress = ratio(completedChecklistItemCount, allChecklistItems.length);

  const completedDeliverableCount = input.deliverables.filter((d) => input.session.completed_deliverable_ids.includes(d.id)).length;
  const deliverableProgress = ratio(completedDeliverableCount, input.deliverables.length);

  const currentPhaseId = input.session.current_phase_id ?? deriveCurrentPhaseId(input.phases, input.session.completed_step_ids);

  return { currentPhaseId, completedStepIds, remainingStepIds, completedMilestoneIds, pendingMilestoneIds, checklistProgress, deliverableProgress, evidenceProgressPlaceholder: null };
}
