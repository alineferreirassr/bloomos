import type { Reservation, ReservationStatus, ReservationResourceType, ReservationSource, AppointmentPriority } from "@/types/scheduling";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27 — Reservation Registry persistence. Same convention as `appointmentsStore.ts`. */
let reservations: Reservation[] = [];

export function resetReservationsStore(): void {
  reservations = [];
}

export interface CreateReservationInput {
  calendar_id: string;
  resource_type: ReservationResourceType;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  source: ReservationSource;
  priority: AppointmentPriority;
  /** `null` means a permanent (non-expiring) hold — created directly as `confirmed`. Non-null creates a `held` reservation that expires at this timestamp unless confirmed first. */
  hold_expires_at: string | null;
  appointment_id: string | null;
}

async function listReservationsForWorkspace(workspaceId: string): Promise<Reservation[]> {
  return reservations.filter((r) => r.workspace_id === workspaceId);
}

async function listReservationsForCalendar(calendarId: string): Promise<Reservation[]> {
  return reservations.filter((r) => r.calendar_id === calendarId);
}

async function getReservationById(id: string): Promise<Reservation | null> {
  return reservations.find((r) => r.id === id) ?? null;
}

async function createReservation(workspaceId: string, createdBy: string, input: CreateReservationInput): Promise<DataResult<Reservation>> {
  if (input.ends_at <= input.starts_at) return fail("Please fix the highlighted fields.", { ends_at: "End time must be after the start time." });

  const timestamp = nowIso();
  const reservation: Reservation = {
    id: generateId("reservation"),
    workspace_id: workspaceId,
    calendar_id: input.calendar_id,
    resource_type: input.resource_type,
    resource_id: input.resource_id,
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    status: input.hold_expires_at !== null ? "held" : "confirmed",
    source: input.source,
    priority: input.priority,
    hold_expires_at: input.hold_expires_at,
    appointment_id: input.appointment_id,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };
  reservations = [...reservations, reservation];
  return ok(reservation);
}

async function setReservationStatus(id: string, workspaceId: string, status: ReservationStatus): Promise<DataResult<Reservation>> {
  const existing = reservations.find((r) => r.id === id && r.workspace_id === workspaceId);
  if (!existing) return fail("This reservation could not be found.");

  const updated: Reservation = { ...existing, status, hold_expires_at: status === "confirmed" || status === "cancelled" || status === "expired" ? null : existing.hold_expires_at, updated_at: nowIso() };
  reservations = reservations.map((r) => (r.id === id ? updated : r));
  return ok(updated);
}

export interface ReservationsRepository {
  listReservationsForWorkspace: typeof listReservationsForWorkspace;
  listReservationsForCalendar: typeof listReservationsForCalendar;
  getReservationById: typeof getReservationById;
  createReservation: typeof createReservation;
  setReservationStatus: typeof setReservationStatus;
}

export const mockReservationsRepository: ReservationsRepository = {
  listReservationsForWorkspace,
  listReservationsForCalendar,
  getReservationById,
  createReservation,
  setReservationStatus,
};
