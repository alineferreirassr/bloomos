import type { ChecklistItem } from "@/types/checklistItem";

export interface ChecklistStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  blocked: number;
  cancelled: number;
  overdue: number;
  /** 0–100, computed against non-cancelled items only. */
  percentComplete: number;
  /** The non-terminal item with the soonest due_date; null if none have one. */
  nextDueItem: ChecklistItem | null;
}

/** Single source of truth for "is this item overdue" — used by both the summary count here and per-item badges on the Checklist page, so they never disagree. */
export function isChecklistItemOverdue(item: ChecklistItem, now: Date = new Date()): boolean {
  return (
    item.status !== "completed" &&
    item.status !== "cancelled" &&
    item.due_date !== null &&
    new Date(item.due_date).getTime() < now.getTime()
  );
}

/**
 * Pure — no I/O, no CRUD. Shared by the read-only Event Detail summary
 * (Phase 2) and the Checklist management page (Phase 3) so both surfaces
 * always agree on the numbers; neither recomputes them independently.
 */
export function computeChecklistStats(items: ChecklistItem[], now: Date = new Date()): ChecklistStats {
  const total = items.length;
  const completed = items.filter((item) => item.status === "completed").length;
  const pending = items.filter((item) => item.status === "pending").length;
  const inProgress = items.filter((item) => item.status === "in_progress").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const cancelled = items.filter((item) => item.status === "cancelled").length;
  const overdue = items.filter((item) => isChecklistItemOverdue(item, now)).length;

  const countable = items.filter((item) => item.status !== "cancelled").length;
  const percentComplete = countable === 0 ? 0 : Math.round((completed / countable) * 100);

  const withDueDates = items
    .filter((item) => item.status !== "completed" && item.status !== "cancelled" && item.due_date !== null)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));

  return {
    total,
    completed,
    pending,
    inProgress,
    blocked,
    cancelled,
    overdue,
    percentComplete,
    nextDueItem: withDueDates[0] ?? null,
  };
}
