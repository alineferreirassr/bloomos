import { describe, expect, it } from "vitest";
import {
  appointmentCreatedEvent,
  appointmentUpdatedEvent,
  appointmentCancelledEvent,
  reservationCreatedEvent,
  reservationConfirmedEvent,
  reservationExpiredEvent,
  schedulingConflictDetectedEvent,
  schedulingConflictResolvedEvent,
  calendarUpdatedEvent,
} from "@/core/scheduling/schedulingTimelineEngine";

describe("schedulingTimelineEngine", () => {
  it("appointmentCreatedEvent", () => {
    expect(appointmentCreatedEvent("Consultation")).toEqual({ type: "appointment_created", description: 'Appointment "Consultation" created.' });
  });

  it("appointmentUpdatedEvent", () => {
    expect(appointmentUpdatedEvent("Consultation")).toEqual({ type: "appointment_updated", description: 'Appointment "Consultation" updated.' });
  });

  it("appointmentCancelledEvent", () => {
    expect(appointmentCancelledEvent("Consultation")).toEqual({ type: "appointment_cancelled", description: 'Appointment "Consultation" cancelled.' });
  });

  it("reservationCreatedEvent", () => {
    expect(reservationCreatedEvent("equipment")).toEqual({ type: "reservation_created", description: "Reservation created for equipment." });
  });

  it("reservationConfirmedEvent", () => {
    expect(reservationConfirmedEvent("vehicle")).toEqual({ type: "reservation_confirmed", description: "Reservation confirmed for vehicle." });
  });

  it("reservationExpiredEvent", () => {
    expect(reservationExpiredEvent("worker")).toEqual({ type: "reservation_expired", description: "Reservation hold expired for worker." });
  });

  it("schedulingConflictDetectedEvent pluralizes correctly", () => {
    expect(schedulingConflictDetectedEvent(1, "Main Calendar")).toEqual({ type: "scheduling_conflict_detected", description: '1 scheduling conflict detected on "Main Calendar".' });
    expect(schedulingConflictDetectedEvent(3, "Main Calendar")).toEqual({ type: "scheduling_conflict_detected", description: '3 scheduling conflicts detected on "Main Calendar".' });
  });

  it("schedulingConflictResolvedEvent", () => {
    expect(schedulingConflictResolvedEvent("Main Calendar")).toEqual({ type: "scheduling_conflict_resolved", description: 'Scheduling conflicts resolved on "Main Calendar".' });
  });

  it("calendarUpdatedEvent", () => {
    expect(calendarUpdatedEvent("Main Calendar")).toEqual({ type: "calendar_updated", description: 'Calendar "Main Calendar" updated.' });
  });
});
