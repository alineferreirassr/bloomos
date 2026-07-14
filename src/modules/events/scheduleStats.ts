import type { EventScheduleItem } from "@/types/eventScheduleItem";

export type ScheduleCompletionState = "not_started" | "in_progress" | "completed";

export interface ScheduleStats {
  total: number;
  /** Earliest item by sort_order (the day-of sequence), not by start_time. */
  first: EventScheduleItem | null;
  last: EventScheduleItem | null;
  delayed: number;
  completed: number;
  completionState: ScheduleCompletionState;
}

/** Pure — no I/O, no CRUD. This is a read-only summary, not the Schedule management UI (Phase 4). */
export function computeScheduleStats(items: EventScheduleItem[]): ScheduleStats {
  const total = items.length;
  const ordered = [...items].sort((a, b) => a.sort_order - b.sort_order);
  const delayed = items.filter((item) => item.status === "delayed").length;
  const completed = items.filter((item) => item.status === "completed").length;

  let completionState: ScheduleCompletionState = "not_started";
  if (total > 0 && completed === total) {
    completionState = "completed";
  } else if (completed > 0) {
    completionState = "in_progress";
  }

  return {
    total,
    first: ordered[0] ?? null,
    last: ordered[ordered.length - 1] ?? null,
    delayed,
    completed,
    completionState,
  };
}
