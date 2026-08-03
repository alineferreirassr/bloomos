import type { Appointment, RecurrenceRule, CalendarView, CalendarViewEntry, CalendarViewGranularity } from "@/types/scheduling";
import { generateOccurrenceDates } from "@/core/scheduling/recurrenceEngine";

/**
 * v2.0 Checkpoint 27, Step 2 — Calendar Engine. Assembles a `CalendarView`
 * for rendering (Calendar Dashboard, Step 17; Calendar Detail View, Step
 * 18) by combining a calendar's real, stored `Appointment[]` with the
 * Recurrence Engine's generated occurrence dates for any appointment
 * that has a `recurrence_rule_id`. The stored `Appointment` itself IS
 * the first/seed occurrence — every other occurrence date is a virtual,
 * synthesized entry (`isRecurringInstance: true`), never a second
 * persisted `Appointment` row.
 */

export function shiftAppointmentToDate(appointment: Appointment, newDate: string): Appointment {
  const startTime = appointment.starts_at.slice(10);
  const endTime = appointment.ends_at.slice(10);
  return {
    ...appointment,
    starts_at: `${newDate}${startTime}`,
    ends_at: `${newDate}${endTime}`,
  };
}

function appointmentOverlapsRange(starts_at: string, ends_at: string, rangeStart: string, rangeEnd: string): boolean {
  return starts_at < rangeEnd && ends_at > rangeStart;
}

/** Cancelled appointments are excluded — a caller wanting to show them (e.g. an audit view) should filter separately rather than this engine special-casing it. */
export function buildCalendarView(calendarId: string, granularity: CalendarViewGranularity, rangeStart: string, rangeEnd: string, appointments: Appointment[], recurrenceRules: RecurrenceRule[]): CalendarView {
  const entries: CalendarViewEntry[] = [];

  for (const appointment of appointments) {
    if (appointment.calendar_id !== calendarId || appointment.status === "cancelled") continue;

    if (appointment.recurrence_rule_id === null) {
      if (appointmentOverlapsRange(appointment.starts_at, appointment.ends_at, rangeStart, rangeEnd)) {
        entries.push({ appointment, isRecurringInstance: false, recurrenceRuleId: null });
      }
      continue;
    }

    const rule = recurrenceRules.find((r) => r.id === appointment.recurrence_rule_id);
    if (rule === undefined) {
      if (appointmentOverlapsRange(appointment.starts_at, appointment.ends_at, rangeStart, rangeEnd)) {
        entries.push({ appointment, isRecurringInstance: false, recurrenceRuleId: null });
      }
      continue;
    }

    const seedDate = appointment.starts_at.slice(0, 10);
    const occurrenceDates = generateOccurrenceDates(rule, seedDate, rangeStart.slice(0, 10), rangeEnd.slice(0, 10));
    for (const occurrenceDate of occurrenceDates) {
      if (occurrenceDate === seedDate) {
        entries.push({ appointment, isRecurringInstance: false, recurrenceRuleId: rule.id });
      } else {
        entries.push({ appointment: shiftAppointmentToDate(appointment, occurrenceDate), isRecurringInstance: true, recurrenceRuleId: rule.id });
      }
    }
  }

  entries.sort((a, b) => a.appointment.starts_at.localeCompare(b.appointment.starts_at));
  return { calendarId, granularity, rangeStart, rangeEnd, entries };
}
