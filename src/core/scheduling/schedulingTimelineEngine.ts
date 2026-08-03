import type { TimelineActivityType } from "@/core/enums/timelineActivityType";

/**
 * v2.0 Checkpoint 27 — Scheduling Timeline Engine. Pure mapping from a
 * scheduling lifecycle transition to the Timeline event it produces —
 * mirrors `capabilityTimelineEngine.ts`'s shape exactly.
 * `schedulingActions.ts` calls these only on a real transition, never on
 * every read/re-validation, same "avoid Timeline noise" discipline.
 */
export interface SchedulingTimelineEvent {
  type: TimelineActivityType;
  description: string;
}

export function appointmentCreatedEvent(title: string): SchedulingTimelineEvent {
  return { type: "appointment_created", description: `Appointment "${title}" created.` };
}

export function appointmentUpdatedEvent(title: string): SchedulingTimelineEvent {
  return { type: "appointment_updated", description: `Appointment "${title}" updated.` };
}

export function appointmentCancelledEvent(title: string): SchedulingTimelineEvent {
  return { type: "appointment_cancelled", description: `Appointment "${title}" cancelled.` };
}

export function reservationCreatedEvent(resourceType: string): SchedulingTimelineEvent {
  return { type: "reservation_created", description: `Reservation created for ${resourceType}.` };
}

export function reservationConfirmedEvent(resourceType: string): SchedulingTimelineEvent {
  return { type: "reservation_confirmed", description: `Reservation confirmed for ${resourceType}.` };
}

export function reservationExpiredEvent(resourceType: string): SchedulingTimelineEvent {
  return { type: "reservation_expired", description: `Reservation hold expired for ${resourceType}.` };
}

export function schedulingConflictDetectedEvent(conflictCount: number, calendarName: string): SchedulingTimelineEvent {
  return { type: "scheduling_conflict_detected", description: `${conflictCount} scheduling conflict${conflictCount === 1 ? "" : "s"} detected on "${calendarName}".` };
}

export function schedulingConflictResolvedEvent(calendarName: string): SchedulingTimelineEvent {
  return { type: "scheduling_conflict_resolved", description: `Scheduling conflicts resolved on "${calendarName}".` };
}

export function calendarUpdatedEvent(calendarName: string): SchedulingTimelineEvent {
  return { type: "calendar_updated", description: `Calendar "${calendarName}" updated.` };
}
