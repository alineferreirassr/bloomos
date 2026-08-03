import type { PlanChecklist } from "@/types/operationalPlanning";

/** v2.0 Checkpoint 27.2, Step 9 — Checklist Engine. Pure reads over a plan's own `checklists` array — each `PlanChecklist` is a frozen snapshot (see `types/operationalPlanning.ts`), so completion state lives directly on its `items`, never re-derived from a live template. */

/** Vacuous 100%-equivalent (`ratio: 1`) for a checklist with zero items. */
export function checklistCompletionRatio(checklist: PlanChecklist): number {
  if (checklist.items.length === 0) return 1;
  return checklist.items.filter((i) => i.completed).length / checklist.items.length;
}

export function isChecklistComplete(checklist: PlanChecklist): boolean {
  return checklist.items.every((i) => i.completed);
}

export function findIncompleteChecklists(checklists: PlanChecklist[]): PlanChecklist[] {
  return checklists.filter((c) => !isChecklistComplete(c));
}
