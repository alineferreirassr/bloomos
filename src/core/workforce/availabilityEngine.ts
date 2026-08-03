import type { AvailabilityWindow, AvailabilityStatus, AvailabilitySummary, Worker, Assignment } from "@/types/workforce";

/**
 * v2.0 Checkpoint 26, Step 4 — Availability Engine. Pure functions over
 * already-fetched data — never touches a store directly, same discipline
 * as `readinessEngine.ts`/`priorityEngine.ts`. "Timezone-aware" means
 * every timestamp stays UTC ISO internally (`AvailabilityWindow.time_zone`
 * is display metadata only) — this engine does no timezone arithmetic; a
 * caller renders a window's `starts_at`/`ends_at` in `time_zone` for
 * display, but "is this window open right now" is decided purely by ISO
 * string comparison against the caller-supplied `now`.
 */

/**
 * The worker's own last-recorded window wins UNLESS they have an active
 * Assignment right now, in which case the display status becomes
 * `"on_assignment"` — the same "computed overlay beats stale stored
 * state" discipline `objectiveEngine.deriveEffectiveStatus` established
 * for `"overdue"`. A worker who forgot to log off a manual "available"
 * window shouldn't read as double-booked-but-available once dispatched.
 */
export function resolveCurrentAvailability(worker: Pick<Worker, "id">, windows: AvailabilityWindow[], activeAssignments: Assignment[], now: string): AvailabilityStatus {
  const hasActiveAssignment = activeAssignments.some((a) => a.worker_id === worker.id && a.status === "active");
  if (hasActiveAssignment) return "on_assignment";

  const workerWindows = windows.filter((w) => w.worker_id === worker.id);
  const covering = workerWindows.find((w) => w.starts_at <= now && (w.ends_at === null || w.ends_at > now));
  if (covering) return covering.status;

  const mostRecentPast = workerWindows.filter((w) => w.starts_at <= now).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  return mostRecentPast?.status ?? "unavailable";
}

export function isWorkerAvailableAt(worker: Pick<Worker, "id">, windows: AvailabilityWindow[], activeAssignments: Assignment[], at: string): boolean {
  return resolveCurrentAvailability(worker, windows, activeAssignments, at) === "available";
}

export function computeAvailabilitySummary(workers: Worker[], windows: AvailabilityWindow[], activeAssignments: Assignment[], now: string): AvailabilitySummary {
  const summary: AvailabilitySummary = { available: 0, onAssignment: 0, busy: 0, onBreak: 0, offDuty: 0, vacation: 0, sickLeave: 0, training: 0, unavailable: 0 };

  for (const worker of workers) {
    const status = resolveCurrentAvailability(worker, windows, activeAssignments, now);
    switch (status) {
      case "available":
        summary.available++;
        break;
      case "on_assignment":
        summary.onAssignment++;
        break;
      case "busy":
        summary.busy++;
        break;
      case "on_break":
        summary.onBreak++;
        break;
      case "off_duty":
        summary.offDuty++;
        break;
      case "vacation":
        summary.vacation++;
        break;
      case "sick_leave":
        summary.sickLeave++;
        break;
      case "training":
        summary.training++;
        break;
      case "unavailable":
        summary.unavailable++;
        break;
    }
  }
  return summary;
}
