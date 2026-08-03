"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getCoreCalendarsService,
  getCoreAppointmentsService,
  getCoreReservationsService,
  getCoreCalendarWindowsService,
  getCoreWorkingHoursService,
  getCoreRecurrenceRulesService,
  getCoreCapacityRulesService,
  getCoreHolidaysService,
  type CreateCalendarInput,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
  type CreateReservationInput,
  type CreateCalendarWindowInput,
  type CreateWorkingHoursRuleInput,
  type CreateRecurrenceRuleInput,
  type CreateCapacityRuleInput,
  type CreateHolidayInput,
} from "@/core/scheduling";
import { getCoreKnowledgeGraphService } from "@/core/knowledge";
import { buildCalendarView } from "@/core/scheduling/calendarEngine";
import { validateAppointmentSchedule } from "@/core/scheduling/scheduleValidationEngine";
import { detectAppointmentConflicts, detectReservationConflicts, type AppointmentConflictInput } from "@/core/scheduling/conflictEngine";
import { checkCanConfirmReservation, isReservationExpired } from "@/core/scheduling/reservationEngine";
import { checkCapacity, countConcurrentUsage, type CapacityUsageEntry } from "@/core/scheduling/capacityEngine";
import { computeSchedulingScores } from "@/core/scheduling/schedulingScoreEngine";
import { detectSchedulingRisks, type CalendarScoreEntry } from "@/core/scheduling/schedulingRiskEngine";
import { schedulingFindingsToRecommendations } from "@/core/scheduling/schedulingFindingsEngine";
import { buildScheduledForRelationship, buildBelongsToCalendarRelationship, buildConflictsWithRelationship, buildReservedForRelationship, type SchedulingRelationshipSpec } from "@/core/scheduling/schedulingKnowledgeGraphEngine";
import { resolveApplicableWorkingHoursRule } from "@/core/scheduling/workingHoursEngine";
import { resolveLocalDateTime } from "@/core/scheduling/timeZoneUtils";
import { appointmentCreatedEvent, appointmentUpdatedEvent, appointmentCancelledEvent, reservationCreatedEvent, reservationConfirmedEvent, reservationExpiredEvent, calendarUpdatedEvent } from "@/core/scheduling/schedulingTimelineEngine";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { nowIso } from "@/lib/data/utils";
import { ENTITY_TYPES, type EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { Calendar, Appointment, Reservation, CalendarWindow, WorkingHoursRule, RecurrenceRule, CapacityRule, Holiday, SchedulingScores, SchedulingFinding, CalendarView, CalendarViewGranularity } from "@/types/scheduling";

const GENERIC_ACCESS_ERROR = "Scheduling isn't available. You may not have access to it.";
const ENTITY_TYPE_SET = new Set<string>(ENTITY_TYPES);
/** How far ahead `evaluateWorkspaceSchedulingAction` looks when computing scores/density — a disclosed, fixed window rather than an open-ended scan. */
const EVALUATION_LOOKAHEAD_DAYS = 7;

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function recordSchedulingTimelineEvent(workspaceId: string, node: KnowledgeNodeRef | null, event: { type: TimelineActivityType; description: string }): void {
  const ownerType = node?.nodeType ?? "workspace";
  const ownerId = node?.nodeId ?? workspaceId;
  if (!ENTITY_TYPE_SET.has(ownerType)) return;
  recordTimelineActivity(workspaceId, ownerType as EntityType, ownerId, event.type, event.description);
}

async function persistRelationship(workspaceId: string, createdBy: string, spec: SchedulingRelationshipSpec | null): Promise<void> {
  if (spec === null) return;
  await getCoreKnowledgeGraphService().createRelationship(workspaceId, createdBy, {
    sourceNodeType: spec.sourceNode.nodeType,
    sourceNodeId: spec.sourceNode.nodeId,
    targetNodeType: spec.targetNode.nodeType,
    targetNodeId: spec.targetNode.nodeId,
    relationshipType: spec.relationshipType,
    source: "user_action",
  });
}

// ---- Calendars ----

export async function createCalendarAction(input: CreateCalendarInput): Promise<ActionResult<Calendar>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreCalendarsService().createCalendar(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listCalendarsAction(includeArchived = false): Promise<ActionResult<Calendar[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const calendars = await getCoreCalendarsService().listCalendarsForWorkspace(session.workspace.id, includeArchived);
  return { success: true, data: calendars };
}

export async function getCalendarAction(id: string): Promise<ActionResult<Calendar>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const calendar = await getCoreCalendarsService().getCalendarById(id);
  if (!calendar || calendar.workspace_id !== session.workspace.id) return { success: false, error: "This calendar could not be found." };
  return { success: true, data: calendar };
}

async function setCalendarStatusAction(id: string, status: "active" | "archived"): Promise<ActionResult<Calendar>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreCalendarsService().setCalendarStatus(id, session.workspace.id, status);
  if (!result.success) return { success: false, error: result.error };
  recordSchedulingTimelineEvent(session.workspace.id, result.data.context, calendarUpdatedEvent(result.data.name));
  return { success: true, data: result.data };
}

export async function archiveCalendarAction(id: string): Promise<ActionResult<Calendar>> {
  return setCalendarStatusAction(id, "archived");
}

export async function reactivateCalendarAction(id: string): Promise<ActionResult<Calendar>> {
  return setCalendarStatusAction(id, "active");
}

// ---- Appointments ----

interface AppointmentConflictContext {
  otherAppointments: Appointment[];
  calendarWindows: CalendarWindow[];
  holidays: Holiday[];
}

async function fetchAppointmentConflictContext(workspaceId: string, calendarId: string): Promise<AppointmentConflictContext> {
  const [otherAppointments, calendarWindows, holidays] = await Promise.all([getCoreAppointmentsService().listAppointmentsForWorkspace(workspaceId), getCoreCalendarWindowsService().listWindowsForCalendar(workspaceId, calendarId), getCoreHolidaysService().listHolidaysForWorkspace(workspaceId)]);
  return { otherAppointments, calendarWindows, holidays };
}

/** Persists `scheduled_for`/`belongs_to_calendar`, plus a `conflicts_with` edge for every `time_overlap` conflict the validation pass found — every write here is best-effort and never fails the surrounding create/update. */
async function syncAppointmentKnowledgeGraph(workspaceId: string, createdBy: string, appointment: Appointment, calendar: Calendar, timeOverlapConflicts: Array<{ affectedAppointmentIds: string[] }>, otherAppointments: Appointment[]): Promise<void> {
  await persistRelationship(workspaceId, createdBy, buildScheduledForRelationship(appointment));
  await persistRelationship(workspaceId, createdBy, buildBelongsToCalendarRelationship(appointment, calendar));
  for (const conflict of timeOverlapConflicts) {
    const other = otherAppointments.find((a) => a.id === conflict.affectedAppointmentIds[0]);
    if (other) await persistRelationship(workspaceId, createdBy, buildConflictsWithRelationship(appointment, other));
  }
}

export async function createAppointmentAction(input: CreateAppointmentInput): Promise<ActionResult<Appointment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const calendar = await getCoreCalendarsService().getCalendarById(input.calendar_id);
  if (!calendar || calendar.workspace_id !== workspaceId) return { success: false, error: "This calendar could not be found." };

  const { otherAppointments, calendarWindows, holidays } = await fetchAppointmentConflictContext(workspaceId, calendar.id);
  const conflictInput: AppointmentConflictInput = {
    candidate: { id: null, calendar_id: calendar.id, workspace_id: workspaceId, starts_at: input.starts_at, ends_at: input.ends_at, worker_id: input.worker_id, preparation_minutes: input.preparation_minutes, cleanup_minutes: input.cleanup_minutes },
    timeZone: calendar.time_zone,
    otherAppointments,
    calendarWindows,
    holidays,
  };
  const validation = validateAppointmentSchedule(input.title, conflictInput);
  if (!validation.valid) return { success: false, error: validation.errors[0]?.detail ?? "This appointment conflicts with the schedule." };

  const result = await getCoreAppointmentsService().createAppointment(workspaceId, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };

  recordSchedulingTimelineEvent(workspaceId, result.data.context, appointmentCreatedEvent(result.data.title));
  await syncAppointmentKnowledgeGraph(
    workspaceId,
    session.membership.id,
    result.data,
    calendar,
    validation.conflicts.filter((c) => c.type === "time_overlap"),
    otherAppointments,
  );

  return { success: true, data: result.data };
}

export async function listAppointmentsAction(calendarId?: string): Promise<ActionResult<Appointment[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const appointments = calendarId ? await getCoreAppointmentsService().listAppointmentsForCalendar(calendarId) : await getCoreAppointmentsService().listAppointmentsForWorkspace(session.workspace.id);
  return { success: true, data: appointments.filter((a) => a.workspace_id === session.workspace.id) };
}

export async function getAppointmentAction(id: string): Promise<ActionResult<Appointment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const appointment = await getCoreAppointmentsService().getAppointmentById(id);
  if (!appointment || appointment.workspace_id !== session.workspace.id) return { success: false, error: "This appointment could not be found." };
  return { success: true, data: appointment };
}

export async function updateAppointmentAction(id: string, input: UpdateAppointmentInput): Promise<ActionResult<Appointment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const existing = await getCoreAppointmentsService().getAppointmentById(id);
  if (!existing || existing.workspace_id !== workspaceId) return { success: false, error: "This appointment could not be found." };
  const calendar = await getCoreCalendarsService().getCalendarById(existing.calendar_id);
  if (!calendar) return { success: false, error: "This calendar could not be found." };

  const merged = { ...existing, ...input };
  const { otherAppointments, calendarWindows, holidays } = await fetchAppointmentConflictContext(workspaceId, calendar.id);
  const conflictInput: AppointmentConflictInput = {
    candidate: { id: existing.id, calendar_id: calendar.id, workspace_id: workspaceId, starts_at: merged.starts_at, ends_at: merged.ends_at, worker_id: merged.worker_id, preparation_minutes: merged.preparation_minutes, cleanup_minutes: merged.cleanup_minutes },
    timeZone: calendar.time_zone,
    otherAppointments,
    calendarWindows,
    holidays,
  };
  const validation = validateAppointmentSchedule(merged.title, conflictInput);
  if (!validation.valid) return { success: false, error: validation.errors[0]?.detail ?? "This appointment conflicts with the schedule." };

  const result = await getCoreAppointmentsService().updateAppointment(id, workspaceId, input);
  if (!result.success) return { success: false, error: result.error };

  recordSchedulingTimelineEvent(workspaceId, result.data.context, appointmentUpdatedEvent(result.data.title));
  await syncAppointmentKnowledgeGraph(
    workspaceId,
    session.membership.id,
    result.data,
    calendar,
    validation.conflicts.filter((c) => c.type === "time_overlap"),
    otherAppointments,
  );

  return { success: true, data: result.data };
}

export async function cancelAppointmentAction(id: string): Promise<ActionResult<Appointment>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreAppointmentsService().setAppointmentStatus(id, session.workspace.id, "cancelled");
  if (!result.success) return { success: false, error: result.error };
  recordSchedulingTimelineEvent(session.workspace.id, result.data.context, appointmentCancelledEvent(result.data.title));
  return { success: true, data: result.data };
}

export async function getCalendarViewAction(calendarId: string, granularity: CalendarViewGranularity, rangeStart: string, rangeEnd: string): Promise<ActionResult<CalendarView>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const calendar = await getCoreCalendarsService().getCalendarById(calendarId);
  if (!calendar || calendar.workspace_id !== session.workspace.id) return { success: false, error: "This calendar could not be found." };

  const appointments = await getCoreAppointmentsService().listAppointmentsForCalendar(calendarId);
  const ruleIds = Array.from(new Set(appointments.map((a) => a.recurrence_rule_id).filter((rid): rid is string => rid !== null)));
  const rules = (await Promise.all(ruleIds.map((rid) => getCoreRecurrenceRulesService().getRuleById(rid)))).filter((r): r is RecurrenceRule => r !== null);

  const view = buildCalendarView(calendarId, granularity, rangeStart, rangeEnd, appointments, rules);
  return { success: true, data: view };
}

// ---- Reservations ----

function resolveReservationNode(linkedAppointment: Appointment | null): KnowledgeNodeRef | null {
  return linkedAppointment?.context ?? null;
}

export async function createReservationAction(input: CreateReservationInput): Promise<ActionResult<Reservation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const existingReservations = await getCoreReservationsService().listReservationsForWorkspace(workspaceId);
  const conflicts = detectReservationConflicts({ id: null, resource_type: input.resource_type, resource_id: input.resource_id, starts_at: input.starts_at, ends_at: input.ends_at }, existingReservations, now);
  if (conflicts.length > 0) return { success: false, error: conflicts[0].description };

  const result = await getCoreReservationsService().createReservation(workspaceId, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };

  const linkedAppointment = result.data.appointment_id !== null ? await getCoreAppointmentsService().getAppointmentById(result.data.appointment_id) : null;
  const node = resolveReservationNode(linkedAppointment);
  recordSchedulingTimelineEvent(workspaceId, node, reservationCreatedEvent(result.data.resource_type));
  if (result.data.status === "confirmed") recordSchedulingTimelineEvent(workspaceId, node, reservationConfirmedEvent(result.data.resource_type));
  await persistRelationship(workspaceId, session.membership.id, buildReservedForRelationship(result.data, linkedAppointment));

  return { success: true, data: result.data };
}

export async function listReservationsAction(calendarId?: string): Promise<ActionResult<Reservation[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const reservations = calendarId ? await getCoreReservationsService().listReservationsForCalendar(calendarId) : await getCoreReservationsService().listReservationsForWorkspace(session.workspace.id);
  return { success: true, data: reservations.filter((r) => r.workspace_id === session.workspace.id) };
}

export async function confirmReservationAction(id: string): Promise<ActionResult<Reservation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;

  const existing = await getCoreReservationsService().getReservationById(id);
  if (!existing || existing.workspace_id !== workspaceId) return { success: false, error: "This reservation could not be found." };
  const check = checkCanConfirmReservation(existing, nowIso());
  if (!check.canConfirm) return { success: false, error: check.reason ?? "This reservation cannot be confirmed." };

  const result = await getCoreReservationsService().setReservationStatus(id, workspaceId, "confirmed");
  if (!result.success) return { success: false, error: result.error };

  const linkedAppointment = result.data.appointment_id !== null ? await getCoreAppointmentsService().getAppointmentById(result.data.appointment_id) : null;
  recordSchedulingTimelineEvent(workspaceId, resolveReservationNode(linkedAppointment), reservationConfirmedEvent(result.data.resource_type));
  await persistRelationship(workspaceId, session.membership.id, buildReservedForRelationship(result.data, linkedAppointment));

  return { success: true, data: result.data };
}

export async function cancelReservationAction(id: string): Promise<ActionResult<Reservation>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreReservationsService().setReservationStatus(id, session.workspace.id, "cancelled");
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

/** Materializes the computed `"expired"` state for any `held` reservation past its `hold_expires_at` — same "definition vs. computed" discipline as the rest of this checkpoint; nothing reads as expired until this sweep (or an equivalent check) runs. */
export async function sweepExpiredReservationsAction(): Promise<ActionResult<Reservation[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();

  const reservations = await getCoreReservationsService().listReservationsForWorkspace(workspaceId);
  const expired: Reservation[] = [];
  for (const reservation of reservations) {
    if (!isReservationExpired(reservation, now)) continue;
    const result = await getCoreReservationsService().setReservationStatus(reservation.id, workspaceId, "expired");
    if (!result.success) continue;
    expired.push(result.data);
    const linkedAppointment = result.data.appointment_id !== null ? await getCoreAppointmentsService().getAppointmentById(result.data.appointment_id) : null;
    recordSchedulingTimelineEvent(workspaceId, resolveReservationNode(linkedAppointment), reservationExpiredEvent(result.data.resource_type));
  }

  return { success: true, data: expired };
}

// ---- Configuration: Calendar Windows, Working Hours, Recurrence Rules, Capacity Rules, Holidays ----
// Thin, session-gated passthroughs — none of these produce a named Timeline event (only the 9 lifecycle events `schedulingTimelineEngine.ts` defines are ever emitted, never a fabricated one for configuration writes).

export async function createCalendarWindowAction(input: CreateCalendarWindowInput): Promise<ActionResult<CalendarWindow>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreCalendarWindowsService().createWindow(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listCalendarWindowsAction(calendarId?: string): Promise<ActionResult<CalendarWindow[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const windows = calendarId ? await getCoreCalendarWindowsService().listWindowsForCalendar(session.workspace.id, calendarId) : await getCoreCalendarWindowsService().listWindowsForWorkspace(session.workspace.id);
  return { success: true, data: windows };
}

export async function createWorkingHoursRuleAction(input: CreateWorkingHoursRuleInput): Promise<ActionResult<WorkingHoursRule>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreWorkingHoursService().createRule(session.workspace.id, session.membership.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listWorkingHoursRulesAction(calendarId: string): Promise<ActionResult<WorkingHoursRule[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const rules = await getCoreWorkingHoursService().listRulesForCalendar(calendarId);
  return { success: true, data: rules };
}

export async function createRecurrenceRuleAction(input: CreateRecurrenceRuleInput): Promise<ActionResult<RecurrenceRule>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreRecurrenceRulesService().createRule(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function createCapacityRuleAction(input: CreateCapacityRuleInput): Promise<ActionResult<CapacityRule>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreCapacityRulesService().createRule(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listCapacityRulesAction(): Promise<ActionResult<CapacityRule[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const rules = await getCoreCapacityRulesService().listRulesForWorkspace(session.workspace.id);
  return { success: true, data: rules };
}

export async function createHolidayAction(input: CreateHolidayInput): Promise<ActionResult<Holiday>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("scheduling.manage")) return { success: false, error: GENERIC_ACCESS_ERROR };
  const result = await getCoreHolidaysService().createHoliday(session.workspace.id, input);
  if (!result.success) return { success: false, error: result.error };
  return { success: true, data: result.data };
}

export async function listHolidaysAction(): Promise<ActionResult<Holiday[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const holidays = await getCoreHolidaysService().listHolidaysForWorkspace(session.workspace.id);
  return { success: true, data: holidays };
}

// ---- Workspace-wide evaluation (Calendar Dashboard + Executive Integration) ----

/** Maps live usage into generic `CapacityUsageEntry`s for `CapacityEngine` — worker usage comes from both an appointment's own `worker_id` and any `"worker"`-type reservation; team usage only when a calendar's own `context_type` is `"team"` (appointments/reservations carry no `team_id` of their own); every appointment also counts toward the workspace scope. */
function buildCapacityUsageEntries(appointments: Appointment[], reservations: Reservation[], calendars: Calendar[]): CapacityUsageEntry[] {
  const entries: CapacityUsageEntry[] = [];
  const calendarById = new Map(calendars.map((c) => [c.id, c] as const));

  for (const appointment of appointments) {
    if (appointment.status === "cancelled") continue;
    entries.push({ scope: "workspace", scope_id: null, starts_at: appointment.starts_at, ends_at: appointment.ends_at });
    if (appointment.worker_id !== null) entries.push({ scope: "worker", scope_id: appointment.worker_id, starts_at: appointment.starts_at, ends_at: appointment.ends_at });
    const calendar = calendarById.get(appointment.calendar_id);
    if (calendar?.context_type === "team" && calendar.context !== null) entries.push({ scope: "team", scope_id: calendar.context.nodeId, starts_at: appointment.starts_at, ends_at: appointment.ends_at });
  }

  for (const reservation of reservations) {
    if (reservation.status === "cancelled" || reservation.status === "expired") continue;
    if (reservation.resource_type === "worker") entries.push({ scope: "worker", scope_id: reservation.resource_id, starts_at: reservation.starts_at, ends_at: reservation.ends_at });
    else entries.push({ scope: "resource", scope_id: reservation.resource_id, starts_at: reservation.starts_at, ends_at: reservation.ends_at });
  }

  return entries;
}

function computeAvailableMinutesForLookahead(rules: WorkingHoursRule[], calendarId: string, timeZone: string, now: string, days: number): number {
  let totalMinutes = 0;
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const dayIso = new Date(new Date(now).getTime() + dayOffset * 24 * 60 * 60_000).toISOString();
    const local = resolveLocalDateTime(dayIso, timeZone);
    const rule = resolveApplicableWorkingHoursRule(rules, calendarId, local.localDate, local.dayOfWeek);
    if (rule === null || rule.is_closed) continue;
    const [startHour, startMinute] = rule.starts_time.split(":").map(Number);
    const [endHour, endMinute] = rule.ends_time.split(":").map(Number);
    totalMinutes += endHour * 60 + endMinute - (startHour * 60 + startMinute);
  }
  return totalMinutes;
}

export interface EvaluateWorkspaceSchedulingResult {
  calendars: Calendar[];
  scoresByCalendarId: Record<string, SchedulingScores>;
  findings: SchedulingFinding[];
}

/**
 * v2.0 Checkpoint 27 — the Calendar Dashboard's (Step 17) data source and
 * the one call `executiveDecisionsActions.ts` makes into this domain
 * (Step 16). Evaluates every calendar over a fixed `EVALUATION_LOOKAHEAD_DAYS`
 * window — never an open-ended scan — computing `SchedulingScores` per
 * calendar and workspace-wide `SchedulingFinding[]`.
 */
export async function evaluateWorkspaceSchedulingAction(): Promise<ActionResult<EvaluateWorkspaceSchedulingResult>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  const workspaceId = session.workspace.id;
  const now = nowIso();
  const windowEnd = new Date(new Date(now).getTime() + EVALUATION_LOOKAHEAD_DAYS * 24 * 60 * 60_000).toISOString();

  const [calendars, appointments, reservations, calendarWindows, holidays, capacityRules] = await Promise.all([
    getCoreCalendarsService().listCalendarsForWorkspace(workspaceId, false),
    getCoreAppointmentsService().listAppointmentsForWorkspace(workspaceId),
    getCoreReservationsService().listReservationsForWorkspace(workspaceId),
    getCoreCalendarWindowsService().listWindowsForWorkspace(workspaceId),
    getCoreHolidaysService().listHolidaysForWorkspace(workspaceId),
    getCoreCapacityRulesService().listRulesForWorkspace(workspaceId),
  ]);

  const workingHoursByCalendar = await Promise.all(calendars.map((c) => getCoreWorkingHoursService().listRulesForCalendar(c.id)));
  const allWorkingHoursRules = workingHoursByCalendar.flat();

  const ruleIds = Array.from(new Set(appointments.map((a) => a.recurrence_rule_id).filter((rid): rid is string => rid !== null)));
  const recurrenceRules = (await Promise.all(ruleIds.map((rid) => getCoreRecurrenceRulesService().getRuleById(rid)))).filter((r): r is RecurrenceRule => r !== null);

  const liveAppointments = appointments.filter((a) => a.status !== "cancelled");
  const usageEntries = buildCapacityUsageEntries(appointments, reservations, calendars);

  const scoresByCalendarId: Record<string, SchedulingScores> = {};
  const calendarScores: CalendarScoreEntry[] = [];

  for (const calendar of calendars) {
    const calendarAppointments = liveAppointments.filter((a) => a.calendar_id === calendar.id && a.starts_at >= now && a.starts_at <= windowEnd);
    const calendarWorkingHours = allWorkingHoursRules.filter((r) => r.calendar_id === calendar.id);

    let windowIssueCount = 0;
    let bufferConflictCount = 0;
    const conflictsForCalendar = [];
    for (const appointment of calendarAppointments) {
      const others = liveAppointments.filter((a) => a.id !== appointment.id);
      const conflicts = detectAppointmentConflicts({
        candidate: { id: appointment.id, calendar_id: appointment.calendar_id, workspace_id: workspaceId, starts_at: appointment.starts_at, ends_at: appointment.ends_at, worker_id: appointment.worker_id, preparation_minutes: appointment.preparation_minutes, cleanup_minutes: appointment.cleanup_minutes },
        timeZone: calendar.time_zone,
        otherAppointments: others,
        calendarWindows,
        holidays,
      });
      conflictsForCalendar.push(...conflicts);
      windowIssueCount += conflicts.filter((c) => c.type === "holiday_conflict" || c.type === "blackout_conflict" || c.type === "timezone_conflict").length;
      bufferConflictCount += conflicts.filter((c) => c.type === "buffer_conflict").length;
    }

    const bookedMinutes = calendarAppointments.reduce((sum, a) => sum + (new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60_000, 0);
    const availableMinutes = computeAvailableMinutesForLookahead(calendarWorkingHours, calendar.id, calendar.time_zone, now, EVALUATION_LOOKAHEAD_DAYS);

    const capacityChecksForCalendar = capacityRules.map((rule) => checkCapacity(rule, { starts_at: now, ends_at: now }, usageEntries));

    const scores = computeSchedulingScores({
      appointmentCount: calendarAppointments.length,
      windowIssueCount,
      bufferConflictCount,
      capacityChecks: capacityChecksForCalendar,
      conflicts: conflictsForCalendar,
      bookedMinutes,
      availableMinutes,
    });

    scoresByCalendarId[calendar.id] = scores;
    calendarScores.push({ calendarId: calendar.id, calendarName: calendar.name, scores, rawDensityRatio: availableMinutes > 0 ? bookedMinutes / availableMinutes : 0 });
  }

  const capacityChecksForRisk = capacityRules.map((rule) => ({ rule, currentUsage: countConcurrentUsage(rule, { starts_at: now, ends_at: now }, usageEntries) }));

  const findings = detectSchedulingRisks({
    calendars,
    appointments,
    reservations,
    calendarWindows,
    holidays,
    workingHoursRules: allWorkingHoursRules,
    recurrenceRules,
    capacityChecks: capacityChecksForRisk,
    calendarScores,
    now,
  });

  return { success: true, data: { calendars, scoresByCalendarId, findings } };
}

/** Adapter `executiveDecisionsActions.ts` calls directly — never re-detects, only translates `evaluateWorkspaceSchedulingAction`'s findings into `OperationalRecommendation`s. */
export async function schedulingRecommendationsForExecutiveDecisions() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];
  const result = await evaluateWorkspaceSchedulingAction();
  if (!result.success) return [];
  const appointments = await getCoreAppointmentsService().listAppointmentsForWorkspace(session.workspace.id);
  return schedulingFindingsToRecommendations(result.data.findings, result.data.calendars, appointments, session.workspace.id);
}
