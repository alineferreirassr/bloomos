/**
 * A single, shared "how urgent is this due date" classifier for the Booking
 * Workflow's Kanban cards (Phase 2) — reused wherever a due date needs the
 * same Overdue/Due Today/Due Tomorrow treatment, rather than each caller
 * re-deriving its own UTC-date comparison (the Dashboard's own
 * `isSameUtcDate` helper in lib/data/index.ts was the closest precedent, but
 * stayed private to that one function).
 */

export type DueState = "overdue" | "due_today" | "due_tomorrow" | null;

function toUtcDateOnly(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** null when there's no due date, or the due date is more than a day away — nothing urgent to flag. */
export function getDueState(dueDateIso: string | null, now: number = Date.now()): DueState {
  if (!dueDateIso) return null;

  const dueUtc = toUtcDateOnly(dueDateIso);
  const todayUtc = toUtcDateOnly(new Date(now).toISOString());

  if (dueUtc < todayUtc) return "overdue";
  if (dueUtc === todayUtc) return "due_today";
  if (dueUtc === todayUtc + ONE_DAY_MS) return "due_tomorrow";
  return null;
}

export const DUE_STATE_LABELS: Record<Exclude<DueState, null>, string> = {
  overdue: "Overdue",
  due_today: "Due Today",
  due_tomorrow: "Due Tomorrow",
};
