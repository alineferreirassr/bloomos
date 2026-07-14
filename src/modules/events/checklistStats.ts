import type { ChecklistItem } from "@/types/checklistItem";

export interface ChecklistStats {
  total: number;
  completed: number;
  pending: number;
  blocked: number;
  overdue: number;
  /** 0–100, computed against non-cancelled items only. */
  percentComplete: number;
  /** The non-terminal item with the soonest due_date; null if none have one. */
  nextDueItem: ChecklistItem | null;
}

/** Pure — no I/O, no CRUD. This is a read-only summary, not the Checklist management UI (Phase 3). */
export function computeChecklistStats(items: ChecklistItem[], now: Date = new Date()): ChecklistStats {
  const total = items.length;
  const completed = items.filter((item) => item.status === "completed").length;
  const pending = items.filter((item) => item.status === "pending").length;
  const blocked = items.filter((item) => item.status === "blocked").length;
  const nowTime = now.getTime();
  const overdue = items.filter(
    (item) =>
      item.status !== "completed" &&
      item.status !== "cancelled" &&
      item.due_date !== null &&
      new Date(item.due_date).getTime() < nowTime,
  ).length;

  const countable = items.filter((item) => item.status !== "cancelled").length;
  const percentComplete = countable === 0 ? 0 : Math.round((completed / countable) * 100);

  const withDueDates = items
    .filter((item) => item.status !== "completed" && item.status !== "cancelled" && item.due_date !== null)
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));

  return { total, completed, pending, blocked, overdue, percentComplete, nextDueItem: withDueDates[0] ?? null };
}
