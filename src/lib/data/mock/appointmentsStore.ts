import type { Appointment, AppointmentStatus, AppointmentPriority, AppointmentContextType } from "@/types/scheduling";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { generateId, nowIso } from "@/lib/data/utils";

/** v2.0 Checkpoint 27 — Appointment persistence. Same convention as `calendarsStore.ts`. */
let appointments: Appointment[] = [];

export function resetAppointmentsStore(): void {
  appointments = [];
}

export interface CreateAppointmentInput {
  calendar_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  priority: AppointmentPriority;
  context_type: AppointmentContextType;
  context: KnowledgeNodeRef | null;
  client_id: string | null;
  worker_id: string | null;
  location_placeholder: string | null;
  preparation_minutes: number;
  cleanup_minutes: number;
  notes: string | null;
  recurrence_rule_id: string | null;
}

export type UpdateAppointmentInput = Partial<Omit<CreateAppointmentInput, "calendar_id" | "context_type">>;

async function listAppointmentsForWorkspace(workspaceId: string): Promise<Appointment[]> {
  return appointments.filter((a) => a.workspace_id === workspaceId);
}

async function listAppointmentsForCalendar(calendarId: string): Promise<Appointment[]> {
  return appointments.filter((a) => a.calendar_id === calendarId);
}

async function getAppointmentById(id: string): Promise<Appointment | null> {
  return appointments.find((a) => a.id === id) ?? null;
}

async function createAppointment(workspaceId: string, createdBy: string, input: CreateAppointmentInput): Promise<DataResult<Appointment>> {
  if (!input.title.trim()) return fail("Please fix the highlighted fields.", { title: "Title is required." });
  if (input.ends_at <= input.starts_at) return fail("Please fix the highlighted fields.", { ends_at: "End time must be after the start time." });

  const timestamp = nowIso();
  const appointment: Appointment = {
    id: generateId("appointment"),
    workspace_id: workspaceId,
    calendar_id: input.calendar_id,
    title: input.title.trim(),
    starts_at: input.starts_at,
    ends_at: input.ends_at,
    status: "tentative",
    priority: input.priority,
    context_type: input.context_type,
    context: input.context,
    client_id: input.client_id,
    worker_id: input.worker_id,
    location_placeholder: input.location_placeholder,
    preparation_minutes: input.preparation_minutes,
    cleanup_minutes: input.cleanup_minutes,
    notes: input.notes,
    recurrence_rule_id: input.recurrence_rule_id,
    created_by: createdBy,
    created_at: timestamp,
    updated_at: timestamp,
  };
  appointments = [...appointments, appointment];
  return ok(appointment);
}

async function updateAppointment(id: string, workspaceId: string, input: UpdateAppointmentInput): Promise<DataResult<Appointment>> {
  const existing = appointments.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This appointment could not be found.");
  if (input.title !== undefined && !input.title.trim()) return fail("Please fix the highlighted fields.", { title: "Title is required." });

  const starts_at = input.starts_at ?? existing.starts_at;
  const ends_at = input.ends_at ?? existing.ends_at;
  if (ends_at <= starts_at) return fail("Please fix the highlighted fields.", { ends_at: "End time must be after the start time." });

  const updated: Appointment = { ...existing, ...input, title: input.title?.trim() ?? existing.title, updated_at: nowIso() };
  appointments = appointments.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

async function setAppointmentStatus(id: string, workspaceId: string, status: AppointmentStatus): Promise<DataResult<Appointment>> {
  const existing = appointments.find((a) => a.id === id && a.workspace_id === workspaceId);
  if (!existing) return fail("This appointment could not be found.");

  const updated: Appointment = { ...existing, status, updated_at: nowIso() };
  appointments = appointments.map((a) => (a.id === id ? updated : a));
  return ok(updated);
}

export interface AppointmentsRepository {
  listAppointmentsForWorkspace: typeof listAppointmentsForWorkspace;
  listAppointmentsForCalendar: typeof listAppointmentsForCalendar;
  getAppointmentById: typeof getAppointmentById;
  createAppointment: typeof createAppointment;
  updateAppointment: typeof updateAppointment;
  setAppointmentStatus: typeof setAppointmentStatus;
}

export const mockAppointmentsRepository: AppointmentsRepository = {
  listAppointmentsForWorkspace,
  listAppointmentsForCalendar,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  setAppointmentStatus,
};
