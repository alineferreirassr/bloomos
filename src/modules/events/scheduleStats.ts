import type { EventScheduleItem } from "@/types/eventScheduleItem";

export type ScheduleCompletionState = "not_started" | "in_progress" | "completed";

export interface ScheduleStats {
  total: number;
  planned: number;
  confirmed: number;
  completed: number;
  delayed: number;
  cancelled: number;
  /** Earliest item by sort_order (the day-of sequence), not by start_time. */
  first: EventScheduleItem | null;
  last: EventScheduleItem | null;
  completionState: ScheduleCompletionState;
  /**
   * The earliest non-null start_time and latest non-null end_time across all
   * items ("HH:MM", same-day — same lexicographic-comparison convention as
   * eventFormSchema's start/end time refine). null when no item has a time
   * set, i.e. the span isn't calculable.
   */
  spanStart: string | null;
  spanEnd: string | null;
}

/**
 * Pure — no I/O, no CRUD. Shared by the read-only Event Detail summary
 * (Phase 2) and the Schedule management page (Phase 4) so both surfaces
 * always agree on the numbers; neither recomputes them independently.
 */
export function computeScheduleStats(items: EventScheduleItem[]): ScheduleStats {
  const total = items.length;
  const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const planned = items.filter((item) => item.status === "planned").length;
  const confirmed = items.filter((item) => item.status === "confirmed").length;
  const completed = items.filter((item) => item.status === "completed").length;
  const delayed = items.filter((item) => item.status === "delayed").length;
  const cancelled = items.filter((item) => item.status === "cancelled").length;

  let completionState: ScheduleCompletionState = "not_started";
  if (total > 0 && completed === total) {
    completionState = "completed";
  } else if (completed > 0) {
    completionState = "in_progress";
  }

  const startTimes = items.map((item) => item.start_time).filter((t): t is string => t !== null).sort();
  const endTimes = items.map((item) => item.end_time).filter((t): t is string => t !== null).sort();

  return {
    total,
    planned,
    confirmed,
    completed,
    delayed,
    cancelled,
    first: ordered[0] ?? null,
    last: ordered[ordered.length - 1] ?? null,
    completionState,
    spanStart: startTimes[0] ?? null,
    spanEnd: endTimes[endTimes.length - 1] ?? null,
  };
}
