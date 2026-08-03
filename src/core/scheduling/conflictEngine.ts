import type { Appointment, Reservation, CalendarWindow, Holiday, ConflictType, ConflictSeverity, SchedulingConflict } from "@/types/scheduling";
import { hasBufferConflict } from "@/core/scheduling/bufferEngine";
import { findHolidayForDate, isEmergencyClosure } from "@/core/scheduling/holidayEngine";
import { isReservationActive } from "@/core/scheduling/reservationEngine";
import { resolveLocalDateTime } from "@/core/scheduling/timeZoneUtils";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 27, Step 7 — Conflict Engine. The one place all 10
 * named `ConflictType`s (`types/scheduling.ts`) get detected. Split into
 * two entry points reflecting the real data model — `Appointment` has no
 * equipment/vehicle field of its own (only an optional `worker_id`), so
 * resource-specific conflicts (`equipment_conflict`/`vehicle_conflict`/
 * `resource_overlap`) are detected against `Reservation`s, which DO carry
 * a `resource_type`/`resource_id`. Never re-implements
 * `assignmentConflictEngine.ts` (Checkpoint 26.1) — that engine asks
 * "can this WORKER be assigned," a WHO question; this one only asks
 * "does this TIME collide with another," a WHEN question.
 */

const CONFLICT_SEVERITY: Record<ConflictType, ConflictSeverity> = {
  time_overlap: "high",
  resource_overlap: "high",
  worker_conflict: "high",
  equipment_conflict: "high",
  vehicle_conflict: "high",
  capacity_conflict: "high",
  holiday_conflict: "high",
  blackout_conflict: "high",
  buffer_conflict: "medium",
  timezone_conflict: "medium",
};

function makeConflict(type: ConflictType, blockingRule: string, description: string, affectedAppointmentIds: string[], affectedReservationIds: string[]): SchedulingConflict {
  return { id: generateId("scheduling_conflict"), type, severity: CONFLICT_SEVERITY[type], blockingRule, description, affectedAppointmentIds, affectedReservationIds };
}

function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export interface AppointmentConflictCandidate {
  id: string | null;
  calendar_id: string;
  workspace_id: string;
  starts_at: string;
  ends_at: string;
  worker_id: string | null;
  preparation_minutes: number;
  cleanup_minutes: number;
}

export interface AppointmentConflictInput {
  candidate: AppointmentConflictCandidate;
  timeZone: string;
  /** Every other live appointment worth checking against — callers typically pass the candidate's own calendar plus any calendar the candidate's worker is also booked on. */
  otherAppointments: Appointment[];
  calendarWindows: CalendarWindow[];
  holidays: Holiday[];
}

function activeAppointments(appointments: Appointment[], excludeId: string | null): Appointment[] {
  return appointments.filter((a) => a.id !== excludeId && a.status !== "cancelled");
}

/** Detects `time_overlap`, `worker_conflict`, `buffer_conflict`, `holiday_conflict`, `blackout_conflict`, and `timezone_conflict` — every conflict type an `Appointment` alone (no `Reservation` needed) can produce. */
export function detectAppointmentConflicts(input: AppointmentConflictInput): SchedulingConflict[] {
  const conflicts: SchedulingConflict[] = [];
  const { candidate } = input;
  const others = activeAppointments(input.otherAppointments, candidate.id);

  for (const other of others) {
    const coreOverlap = other.calendar_id === candidate.calendar_id && overlaps(candidate.starts_at, candidate.ends_at, other.starts_at, other.ends_at);
    if (coreOverlap) {
      conflicts.push(makeConflict("time_overlap", "time_overlap: two appointments on the same calendar cannot occupy the same time", `Overlaps appointment "${other.title}" on the same calendar`, [other.id], []));
    } else if (other.calendar_id === candidate.calendar_id && hasBufferConflict(candidate, other)) {
      conflicts.push(makeConflict("buffer_conflict", "buffer_conflict: preparation/cleanup time cannot overlap another appointment", `Preparation/cleanup buffer collides with appointment "${other.title}"`, [other.id], []));
    }

    if (candidate.worker_id !== null && other.worker_id === candidate.worker_id && overlaps(candidate.starts_at, candidate.ends_at, other.starts_at, other.ends_at)) {
      conflicts.push(makeConflict("worker_conflict", "worker_conflict: the same worker cannot be double-booked", `Worker is already booked on appointment "${other.title}" at this time`, [other.id], []));
    }
  }

  const startLocal = resolveLocalDateTime(candidate.starts_at, input.timeZone);
  const endLocal = resolveLocalDateTime(candidate.ends_at, input.timeZone);
  if (startLocal.localDate !== endLocal.localDate) {
    conflicts.push(makeConflict("timezone_conflict", "timezone_conflict: an appointment must resolve to a single local calendar day", "This platform does not yet support an appointment spanning more than one local calendar day", [], []));
  }

  const holiday = findHolidayForDate(input.holidays, candidate.workspace_id, startLocal.localDate);
  if (holiday !== null) {
    const emergency = isEmergencyClosure(input.holidays, candidate.workspace_id, startLocal.localDate);
    conflicts.push(makeConflict("holiday_conflict", "holiday_conflict: cannot schedule on a workspace holiday", `${emergency ? "Emergency closure" : "Holiday"}: ${holiday.name}`, [], []));
  }

  const blockingWindow = input.calendarWindows.find((w) => (w.calendar_id === candidate.calendar_id || w.calendar_id === null) && w.type !== "available" && overlaps(w.starts_at, w.ends_at, candidate.starts_at, candidate.ends_at));
  if (blockingWindow !== undefined) {
    conflicts.push(makeConflict("blackout_conflict", "blackout_conflict: cannot schedule during a blocked calendar window", blockingWindow.reason ?? `Calendar is ${blockingWindow.type} during this time`, [], []));
  }

  return conflicts;
}

const RESOURCE_TYPE_CONFLICT: Record<Reservation["resource_type"], ConflictType> = {
  worker: "worker_conflict",
  equipment: "equipment_conflict",
  vehicle: "vehicle_conflict",
  asset: "resource_overlap",
};

export interface ReservationConflictCandidate {
  id: string | null;
  resource_type: Reservation["resource_type"];
  resource_id: string;
  starts_at: string;
  ends_at: string;
}

/** Detects `resource_overlap`/`worker_conflict`/`equipment_conflict`/`vehicle_conflict` — whichever `ConflictType` matches the candidate's own `resource_type`. */
export function detectReservationConflicts(candidate: ReservationConflictCandidate, existingReservations: Reservation[], now: string): SchedulingConflict[] {
  const conflictType = RESOURCE_TYPE_CONFLICT[candidate.resource_type];
  const conflicting = existingReservations.filter((r) => {
    if (r.id === candidate.id) return false;
    if (r.resource_type !== candidate.resource_type || r.resource_id !== candidate.resource_id) return false;
    if (!isReservationActive(r, now)) return false;
    return overlaps(candidate.starts_at, candidate.ends_at, r.starts_at, r.ends_at);
  });

  return conflicting.map((r) => makeConflict(conflictType, `${conflictType}: the same ${candidate.resource_type} cannot be double-booked`, `Resource is already reserved (reservation ${r.id})`, r.appointment_id !== null ? [r.appointment_id] : [], [r.id]));
}

export interface CapacityConflictInput {
  scope: string;
  scopeId: string | null;
  currentUsage: number;
  maxConcurrent: number;
}

/** Thin adapter turning a `CapacityEngine.checkCapacity` breach into a `SchedulingConflict` — kept here rather than in `capacityEngine.ts` so every `SchedulingConflict` is built through this file's single `makeConflict`. */
export function buildCapacityConflict(input: CapacityConflictInput): SchedulingConflict {
  return makeConflict("capacity_conflict", `capacity_conflict: at most ${input.maxConcurrent} concurrent for ${input.scope}`, `Capacity of ${input.maxConcurrent} already reached (${input.currentUsage} in use) for ${input.scope}${input.scopeId ? ` "${input.scopeId}"` : ""}`, [], []);
}
