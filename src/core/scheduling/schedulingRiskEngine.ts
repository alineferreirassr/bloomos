import type { Calendar, Appointment, Reservation, CalendarWindow, Holiday, WorkingHoursRule, RecurrenceRule, CapacityRule, SchedulingFinding, SchedulingFindingType, SchedulingScores } from "@/types/scheduling";
import { resolveAvailabilityForInterval } from "@/core/scheduling/availabilityWindowEngine";
import { findHolidayForDate, isEmergencyClosure } from "@/core/scheduling/holidayEngine";
import { generateOccurrenceDates } from "@/core/scheduling/recurrenceEngine";
import { shiftAppointmentToDate } from "@/core/scheduling/calendarEngine";
import { detectAppointmentConflicts } from "@/core/scheduling/conflictEngine";
import { isReservationExpired } from "@/core/scheduling/reservationEngine";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 27, Step 16 — Workforce Risk Detection's scheduling
 * counterpart. Seven named, deterministic detectors over already-computed
 * data — no AI, no randomness, no new evaluation logic; every detector
 * calls into an engine this checkpoint already built rather than
 * re-implementing its logic.
 */

const RECURRING_CONFLICT_LOOKAHEAD_DAYS = 90;
const DEFAULT_RESERVATION_EXPIRATION_WARNING_MINUTES = 30;
const CALENDAR_HEALTH_RISK_THRESHOLD = 70;

export interface CalendarScoreEntry {
  calendarId: string;
  calendarName: string;
  scores: SchedulingScores;
  /** Unclamped booked/available ratio (`> 1` means genuinely overbooked) — `scheduleDensityScore` itself clamps at 100, so it alone can't distinguish "full" from "overbooked." */
  rawDensityRatio: number;
}

export interface DetectSchedulingRisksInput {
  calendars: Calendar[];
  appointments: Appointment[];
  reservations: Reservation[];
  calendarWindows: CalendarWindow[];
  holidays: Holiday[];
  workingHoursRules: WorkingHoursRule[];
  recurrenceRules: RecurrenceRule[];
  capacityChecks: Array<{ rule: CapacityRule; currentUsage: number }>;
  calendarScores: CalendarScoreEntry[];
  now: string;
  reservationExpirationWarningMinutes?: number;
}

function finding(type: SchedulingFindingType, severity: SchedulingFinding["severity"], description: string, related: Partial<Pick<SchedulingFinding, "relatedCalendarId" | "relatedAppointmentId" | "relatedReservationId">> = {}): SchedulingFinding {
  return {
    id: generateId("scheduling_finding"),
    type,
    severity,
    description,
    relatedCalendarId: related.relatedCalendarId ?? null,
    relatedAppointmentId: related.relatedAppointmentId ?? null,
    relatedReservationId: related.relatedReservationId ?? null,
  };
}

function activeAppointments(appointments: Appointment[]): Appointment[] {
  return appointments.filter((a) => a.status !== "cancelled");
}

export function detectSchedulingRisks(input: DetectSchedulingRisksInput): SchedulingFinding[] {
  const findings: SchedulingFinding[] = [];
  const calendarById = new Map(input.calendars.map((c) => [c.id, c] as const));
  const live = activeAppointments(input.appointments);
  const warningMinutes = input.reservationExpirationWarningMinutes ?? DEFAULT_RESERVATION_EXPIRATION_WARNING_MINUTES;

  // 1. Overbooked Schedule
  for (const entry of input.calendarScores) {
    if (entry.rawDensityRatio > 1) {
      findings.push(finding("overbooked_schedule", "high", `"${entry.calendarName}" is booked beyond its available working hours (${Math.round(entry.rawDensityRatio * 100)}% of capacity).`, { relatedCalendarId: entry.calendarId }));
    }
  }

  // 2. Unavailable Time Window
  for (const appointment of live) {
    const calendar = calendarById.get(appointment.calendar_id);
    if (calendar === undefined) continue;
    const result = resolveAvailabilityForInterval({
      calendarId: calendar.id,
      workspaceId: calendar.workspace_id,
      timeZone: calendar.time_zone,
      starts_at: appointment.starts_at,
      ends_at: appointment.ends_at,
      workingHoursRules: input.workingHoursRules,
      calendarWindows: input.calendarWindows,
      holidays: input.holidays,
    });
    if (!result.available) {
      findings.push(finding("unavailable_time_window", "high", `"${appointment.title}" is scheduled during a time that is no longer available: ${result.reason ?? "unavailable"}.`, { relatedCalendarId: calendar.id, relatedAppointmentId: appointment.id }));
    }
  }

  // 3. Capacity Exhausted
  for (const { rule, currentUsage } of input.capacityChecks) {
    if (currentUsage >= rule.max_concurrent) {
      findings.push(finding("capacity_exhausted", "high", `Capacity of ${rule.max_concurrent} for ${rule.scope}${rule.scope_id ? ` "${rule.scope_id}"` : ""} is fully used (${currentUsage} active).`));
    }
  }

  // 4. Recurring Conflict
  for (const appointment of live) {
    if (appointment.recurrence_rule_id === null) continue;
    const rule = input.recurrenceRules.find((r) => r.id === appointment.recurrence_rule_id);
    if (rule === undefined) continue;

    const seedDate = appointment.starts_at.slice(0, 10);
    const lookaheadEnd = new Date(new Date(input.now).getTime() + RECURRING_CONFLICT_LOOKAHEAD_DAYS * 24 * 60 * 60_000).toISOString().slice(0, 10);
    const occurrenceDates = generateOccurrenceDates(rule, seedDate, input.now.slice(0, 10), lookaheadEnd).filter((d) => d !== seedDate);

    const calendar = calendarById.get(appointment.calendar_id);
    if (calendar === undefined) continue;
    const othersOnCalendar = live.filter((a) => a.id !== appointment.id && a.calendar_id === appointment.calendar_id);

    for (const occurrenceDate of occurrenceDates) {
      const shifted = shiftAppointmentToDate(appointment, occurrenceDate);
      const conflicts = detectAppointmentConflicts({
        candidate: { id: appointment.id, calendar_id: shifted.calendar_id, workspace_id: shifted.workspace_id, starts_at: shifted.starts_at, ends_at: shifted.ends_at, worker_id: shifted.worker_id, preparation_minutes: shifted.preparation_minutes, cleanup_minutes: shifted.cleanup_minutes },
        timeZone: calendar.time_zone,
        otherAppointments: othersOnCalendar,
        calendarWindows: input.calendarWindows,
        holidays: input.holidays,
      });
      if (conflicts.length > 0) {
        findings.push(finding("recurring_conflict", "medium", `A future occurrence of "${appointment.title}" on ${occurrenceDate} conflicts with another appointment.`, { relatedCalendarId: calendar.id, relatedAppointmentId: appointment.id }));
        break;
      }
    }
  }

  // 5. Holiday Conflict
  for (const appointment of live) {
    const calendar = calendarById.get(appointment.calendar_id);
    if (calendar === undefined) continue;
    const localDate = appointment.starts_at.slice(0, 10);
    const holiday = findHolidayForDate(input.holidays, calendar.workspace_id, localDate);
    if (holiday !== null) {
      const emergency = isEmergencyClosure(input.holidays, calendar.workspace_id, localDate);
      findings.push(finding("holiday_conflict", emergency ? "high" : "medium", `"${appointment.title}" is scheduled on ${emergency ? "an emergency closure" : "a holiday"}: ${holiday.name}.`, { relatedCalendarId: calendar.id, relatedAppointmentId: appointment.id }));
    }
  }

  // 6. Reservation Expiration
  for (const reservation of input.reservations) {
    if (reservation.status !== "held" || reservation.hold_expires_at === null) continue;
    if (isReservationExpired(reservation, input.now)) {
      findings.push(finding("reservation_expiration", "medium", `A held reservation for ${reservation.resource_type} "${reservation.resource_id}" has already expired.`, { relatedCalendarId: reservation.calendar_id, relatedReservationId: reservation.id }));
      continue;
    }
    const minutesUntilExpiration = Math.round((new Date(reservation.hold_expires_at).getTime() - new Date(input.now).getTime()) / 60_000);
    if (minutesUntilExpiration <= warningMinutes) {
      findings.push(finding("reservation_expiration", "low", `A held reservation for ${reservation.resource_type} "${reservation.resource_id}" expires in ${minutesUntilExpiration} minute${minutesUntilExpiration === 1 ? "" : "s"}.`, { relatedCalendarId: reservation.calendar_id, relatedReservationId: reservation.id }));
    }
  }

  // 7. Calendar Health
  for (const entry of input.calendarScores) {
    if (entry.scores.calendarHealthScore < CALENDAR_HEALTH_RISK_THRESHOLD) {
      findings.push(finding("calendar_health", "medium", `"${entry.calendarName}" has a low calendar health score (${Math.round(entry.scores.calendarHealthScore)}/100).`, { relatedCalendarId: entry.calendarId }));
    }
  }

  return findings;
}
