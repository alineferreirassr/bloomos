import { mockCalendarsRepository } from "@/lib/data/mock/calendarsStore";
import { mockAppointmentsRepository } from "@/lib/data/mock/appointmentsStore";
import { mockReservationsRepository } from "@/lib/data/mock/reservationsStore";
import { mockCalendarWindowsRepository } from "@/lib/data/mock/calendarWindowsStore";
import { mockWorkingHoursRepository } from "@/lib/data/mock/workingHoursStore";
import { mockRecurrenceRulesRepository } from "@/lib/data/mock/recurrenceRulesStore";
import { mockCapacityRulesRepository } from "@/lib/data/mock/capacityRulesStore";
import { mockHolidaysRepository } from "@/lib/data/mock/holidaysStore";

export type { Calendar, CalendarContextType, CalendarStatus } from "@/types/scheduling";
export type { Appointment, AppointmentStatus, AppointmentPriority, AppointmentContextType } from "@/types/scheduling";
export type { Reservation, ReservationStatus, ReservationResourceType, ReservationSource } from "@/types/scheduling";
export type { CalendarWindow, CalendarWindowType } from "@/types/scheduling";
export type { WorkingHoursRule, WorkingHoursKind } from "@/types/scheduling";
export type { RecurrenceRule, RecurrenceFrequency, NthWeekday } from "@/types/scheduling";
export type { CapacityRule, CapacityScope, CapacityWindowKind } from "@/types/scheduling";
export type { Holiday, HolidayScope } from "@/types/scheduling";

export type { CreateCalendarInput, CalendarsRepository } from "@/lib/data/mock/calendarsStore";
export type { CreateAppointmentInput, UpdateAppointmentInput, AppointmentsRepository } from "@/lib/data/mock/appointmentsStore";
export type { CreateReservationInput, ReservationsRepository } from "@/lib/data/mock/reservationsStore";
export type { CreateCalendarWindowInput, CalendarWindowsRepository } from "@/lib/data/mock/calendarWindowsStore";
export type { CreateWorkingHoursRuleInput, WorkingHoursRepository } from "@/lib/data/mock/workingHoursStore";
export type { CreateRecurrenceRuleInput, RecurrenceRulesRepository } from "@/lib/data/mock/recurrenceRulesStore";
export type { CreateCapacityRuleInput, CapacityRulesRepository } from "@/lib/data/mock/capacityRulesStore";
export type { CreateHolidayInput, HolidaysRepository } from "@/lib/data/mock/holidaysStore";

/** v2.0 Checkpoint 27 — Mock-only accessors, one per store, same precedent as `core/workforce`/`core/capability`. No Supabase table exists yet for any Scheduling concept. */
export function getCoreCalendarsService() {
  return mockCalendarsRepository;
}

export function getCoreAppointmentsService() {
  return mockAppointmentsRepository;
}

export function getCoreReservationsService() {
  return mockReservationsRepository;
}

export function getCoreCalendarWindowsService() {
  return mockCalendarWindowsRepository;
}

export function getCoreWorkingHoursService() {
  return mockWorkingHoursRepository;
}

export function getCoreRecurrenceRulesService() {
  return mockRecurrenceRulesRepository;
}

export function getCoreCapacityRulesService() {
  return mockCapacityRulesRepository;
}

export function getCoreHolidaysService() {
  return mockHolidaysRepository;
}
