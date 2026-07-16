import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { EntityType } from "@/core/enums/entityType";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { EVENT_STATUS_LABELS, type EventStatus } from "@/core/enums/eventStatus";
import { EVENT_TYPE_LABELS } from "@/core/enums/eventType";
import { EVENT_LIFECYCLE_STAGE_LABELS, type EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import { EVENT_PRIORITY_LABELS, type EventPriority } from "@/core/enums/eventPriority";
import { SCHEDULE_STATUS_LABELS, type ScheduleStatus } from "@/core/enums/scheduleStatus";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import {
  canTransitionEventStatus,
  canTransitionLifecycleStage,
  isEventTerminal,
  getEventNextRecommendedAction,
} from "@/core/workflows/eventWorkflow";
import { eventDataSchema, scheduleItemSchema, type EventFormInput, type ScheduleItemInput } from "@/modules/events/schema";
import { checklistItemSchema, type ChecklistItemInput } from "@/modules/checklist/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import { DEFAULT_CHECKLIST_TEMPLATES } from "@/modules/events/constants/checklistTemplates";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import {
  mapEventRow,
  mapChecklistItemRow,
  mapEventScheduleItemRow,
  mapClientRow,
  mapNoteRow,
  mapTimelineActivityRow,
} from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { EventFilters, EventsRepository } from "@/lib/data/events/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Same rationale as leads/clients supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/**
 * Unlike Leads'/Clients' insertTimelineActivity (hardcoded owner_type
 * 'lead'/'client'), Events' checklist_item_completed/schedule_item_updated
 * entries are recorded via the owning row's own owner_type/owner_id — always
 * 'event' in practice today (only Event owns Checklist/Schedule items), but
 * kept parameterized to match the mock's genericity exactly.
 */
async function insertTimelineActivity(
  supabase: SupabaseClient,
  actor: string,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  type: TimelineActivityType,
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Internal existence check — returns null rather than throwing, matching the mock's `readEvents().find(...)` pattern. RLS means an event in another Workspace is simply invisible here, not a distinct error case. */
async function fetchEventRow(id: string): Promise<Event | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapEventRow(data) : null;
}

async function fetchChecklistItemRow(id: string): Promise<ChecklistItem | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("checklist_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapChecklistItemRow(data) : null;
}

async function fetchScheduleItemRow(id: string): Promise<EventScheduleItem | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("event_schedule_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapEventScheduleItemRow(data) : null;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  const session = await requireWorkspaceSession();
  const { search, status, lifecycleStage, eventType, priority, clientId, dateFrom, dateTo, includeArchived = false } =
    filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("events").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) query = query.neq("status", "archived");
  if (status && status !== "all") query = query.eq("status", status);
  if (lifecycleStage && lifecycleStage !== "all") query = query.eq("lifecycle_stage", lifecycleStage);
  if (eventType && eventType !== "all") query = query.eq("event_type", eventType);
  if (priority && priority !== "all") query = query.eq("priority", priority);
  if (clientId) query = query.eq("client_id", clientId);
  // Comparing against a null event_date naturally excludes it in SQL (null >= x is unknown, not true),
  // matching the mock's `if (!event.event_date) return false` whenever either bound is set.
  if (dateFrom) query = query.gte("event_date", dateFrom);
  if (dateTo) query = query.lte("event_date", dateTo);

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  const events = (data ?? []).map(mapEventRow);

  const q = search?.trim().toLowerCase();
  if (!q) return events;

  const { data: clientRows, error: clientsError } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", session.workspace.id);
  if (clientsError) throw normalizeSupabaseError(clientsError);
  const clientsById = new Map((clientRows ?? []).map(mapClientRow).map((c) => [c.id, c]));

  return events.filter((event) => {
    const client = clientsById.get(event.client_id);
    const clientName = client ? `${client.first_name} ${client.last_name}` : "";
    const haystack = `${event.title} ${clientName} ${event.location_name ?? ""} ${event.city ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getEventById(id: string): Promise<Event> {
  const event = await fetchEventRow(id);
  if (!event) {
    throw new NotFoundError(`Event ${id} was not found`);
  }
  return event;
}

async function createEvent(input: EventFormInput): Promise<DataResult<Event>> {
  const parsed = eventDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.client_id)
    .maybeSingle();
  if (clientError) throw normalizeSupabaseError(clientError);
  if (!clientRow) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }
  const client = mapClientRow(clientRow);

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("events")
    .insert({
      workspace_id: client.workspace_id,
      ...parsed.data,
      status: "draft",
      lifecycle_stage: "intake",
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const event = mapEventRow(data);
  await insertTimelineActivity(supabase, actor, event.workspace_id, "event", event.id, "event_created", "Event created");

  // Mirrors the mock's createEvent() exactly: applying the default checklist
  // is a separate step from creating the Event, and its result (success or
  // validation failure) is intentionally discarded — a template failure
  // never blocks Event creation. Since DEFAULT_CHECKLIST_TEMPLATES entries
  // are compile-time-typed ChecklistItemInput[], the validation loop below
  // is defensive parity with the mock, not a realistically reachable branch.
  const defaultChecklist = DEFAULT_CHECKLIST_TEMPLATES[event.event_type];
  if (defaultChecklist) {
    const parsedItems: ChecklistItemInput[] = [];
    let validTemplate = true;
    for (const templateItem of defaultChecklist) {
      const parsedItem = checklistItemSchema.safeParse(templateItem);
      if (!parsedItem.success) {
        validTemplate = false;
        break;
      }
      parsedItems.push(parsedItem.data);
    }
    if (validTemplate) {
      const description = `Default ${EVENT_TYPE_LABELS[event.event_type]} checklist created with ${parsedItems.length} item${parsedItems.length === 1 ? "" : "s"}.`;
      const { error: rpcError } = await supabase.rpc("apply_default_event_checklist", {
        p_event_id: event.id,
        p_items: parsedItems,
        p_description: description,
        p_actor: actor,
      });
      if (rpcError) throw normalizeSupabaseError(rpcError);
    }
  }

  return ok(event);
}

async function updateEvent(id: string, input: EventFormInput): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }

  const parsed = eventDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data: clientRow, error: clientError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", parsed.data.client_id)
    .maybeSingle();
  if (clientError) throw normalizeSupabaseError(clientError);
  if (!clientRow) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }

  const session = await requireWorkspaceSession();
  const { data, error } = await supabase.from("events").update(parsed.data).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "event",
    id,
    "event_updated",
    "Event information updated",
  );

  return ok(updated);
}

async function updateEventStatus(id: string, status: EventStatus): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (!canTransitionEventStatus(existing.status, status)) {
    return fail(
      `Cannot move an event from "${EVENT_STATUS_LABELS[existing.status]}" to "${EVENT_STATUS_LABELS[status]}".`,
    );
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("events").update({ status }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "event",
    id,
    "status_changed",
    `Status changed from ${EVENT_STATUS_LABELS[existing.status]} to ${EVENT_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function updateEventLifecycleStage(id: string, stage: EventLifecycleStage): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (!canTransitionLifecycleStage(existing.lifecycle_stage, stage)) {
    return fail(
      `Cannot move an event from "${EVENT_LIFECYCLE_STAGE_LABELS[existing.lifecycle_stage]}" to "${EVENT_LIFECYCLE_STAGE_LABELS[stage]}".`,
    );
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .update({ lifecycle_stage: stage })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "event",
    id,
    "lifecycle_stage_changed",
    `Lifecycle stage changed from ${EVENT_LIFECYCLE_STAGE_LABELS[existing.lifecycle_stage]} to ${EVENT_LIFECYCLE_STAGE_LABELS[stage]}`,
    { from: existing.lifecycle_stage, to: stage },
  );

  return ok(updated);
}

async function updateEventPriority(id: string, priority: EventPriority): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("events").update({ priority }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "event",
    id,
    "priority_changed",
    `Priority changed from ${EVENT_PRIORITY_LABELS[existing.priority]} to ${EVENT_PRIORITY_LABELS[priority]}`,
    { from: existing.priority, to: priority },
  );

  return ok(updated);
}

async function archiveEvent(id: string): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (existing.status === "archived") {
    return fail("This event is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "event", id, "event_archived", "Event archived");

  return ok(updated);
}

async function restoreEvent(id: string): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (existing.status !== "archived") {
    return fail("This event is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "planning", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "event", id, "event_restored", "Event restored");

  return ok(updated);
}

async function cancelEvent(id: string): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (isEventTerminal(existing.status)) {
    return fail(`This event is already ${EVENT_STATUS_LABELS[existing.status].toLowerCase()} and can't be cancelled.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "cancelled", cancelled_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "event", id, "event_cancelled", "Event cancelled");

  return ok(updated);
}

async function completeEvent(id: string): Promise<DataResult<Event>> {
  const existing = await fetchEventRow(id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (isEventTerminal(existing.status)) {
    return fail(`This event is already ${EVENT_STATUS_LABELS[existing.status].toLowerCase()} and can't be completed.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("events")
    .update({ status: "completed", completed_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "event", id, "event_completed", "Event completed");

  return ok(updated);
}

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

/** Shared by getChecklistByEventId and reorderChecklistItems, which both need this query but must not re-fetch the Event row a second time once they already have it. */
async function fetchChecklistItemsForEvent(workspaceId: string, eventId: string): Promise<ChecklistItem[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", "event")
    .eq("owner_id", eventId)
    .order("sort_order", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapChecklistItemRow);
}

async function getChecklistByEventId(eventId: string): Promise<ChecklistItem[]> {
  const event = await fetchEventRow(eventId);
  if (!event) return [];
  return fetchChecklistItemsForEvent(event.workspace_id, eventId);
}

async function createChecklistItem(eventId: string, input: ChecklistItemInput): Promise<DataResult<ChecklistItem>> {
  const event = await fetchEventRow(eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { count, error: countError } = await supabase
    .from("checklist_items")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", event.workspace_id)
    .eq("owner_type", "event")
    .eq("owner_id", eventId);
  if (countError) throw normalizeSupabaseError(countError);

  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      workspace_id: event.workspace_id,
      owner_type: "event",
      owner_id: eventId,
      ...parsed.data,
      status: "pending",
      completed_at: null,
      sort_order: count ?? 0,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const item = mapChecklistItemRow(data);
  await insertTimelineActivity(
    supabase,
    actor,
    event.workspace_id,
    "event",
    eventId,
    "checklist_item_created",
    `Checklist item created: "${item.title}"`,
  );

  return ok(item);
}

async function updateChecklistItem(id: string, input: ChecklistItemInput): Promise<DataResult<ChecklistItem>> {
  const existing = await fetchChecklistItemRow(id);
  if (!existing) {
    return fail("Checklist item not found.");
  }

  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapChecklistItemRow(data));
}

async function updateChecklistItemStatus(id: string, status: ChecklistStatus): Promise<DataResult<ChecklistItem>> {
  const existing = await fetchChecklistItemRow(id);
  if (!existing) {
    return fail("Checklist item not found.");
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("checklist_items")
    .update({
      status,
      completed_at: status === "completed" ? (existing.completed_at ?? new Date().toISOString()) : null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return ok(mapChecklistItemRow(data));
}

async function completeChecklistItem(id: string): Promise<DataResult<ChecklistItem>> {
  const existing = await fetchChecklistItemRow(id);
  if (!existing) {
    return fail("Checklist item not found.");
  }
  if (existing.status === "completed") {
    return fail("This checklist item is already completed.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("checklist_items")
    .update({ status: "completed", completed_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapChecklistItemRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "checklist_item_completed",
    `Checklist item completed: "${existing.title}"`,
  );

  return ok(updated);
}

async function deleteChecklistItem(id: string): Promise<DataResult<null>> {
  const existing = await fetchChecklistItemRow(id);
  if (!existing) {
    return fail("Checklist item not found.");
  }
  if (existing.status === "completed") {
    return fail("Completed checklist items can't be deleted.");
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from("checklist_items").delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);

  return ok(null);
}

async function reorderChecklistItems(eventId: string, orderedIds: string[]): Promise<DataResult<ChecklistItem[]>> {
  const event = await fetchEventRow(eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const ownItems = await fetchChecklistItemsForEvent(event.workspace_id, eventId);
  if (orderedIds.length !== ownItems.length || !ownItems.every((item) => orderedIds.includes(item.id))) {
    return fail("The provided order doesn't match this event's checklist items.");
  }

  const supabase = createSupabaseClient();
  const { error } = await Promise.all(
    orderedIds.map((id, index) => supabase.from("checklist_items").update({ sort_order: index }).eq("id", id)),
  ).then((results) => {
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  });
  if (error) throw normalizeSupabaseError(error);

  return ok(await fetchChecklistItemsForEvent(event.workspace_id, eventId));
}

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** Shared by getScheduleByEventId and reorderScheduleItems, which both need this query but must not re-fetch the Event row a second time once they already have it. */
async function fetchScheduleItemsForEvent(workspaceId: string, eventId: string): Promise<EventScheduleItem[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("event_schedule_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", "event")
    .eq("owner_id", eventId)
    .order("sort_order", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapEventScheduleItemRow);
}

async function getScheduleByEventId(eventId: string): Promise<EventScheduleItem[]> {
  const event = await fetchEventRow(eventId);
  if (!event) return [];
  return fetchScheduleItemsForEvent(event.workspace_id, eventId);
}

async function createScheduleItem(eventId: string, input: ScheduleItemInput): Promise<DataResult<EventScheduleItem>> {
  const event = await fetchEventRow(eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { count, error: countError } = await supabase
    .from("event_schedule_items")
    .select("*", { count: "exact", head: true })
    .eq("workspace_id", event.workspace_id)
    .eq("owner_type", "event")
    .eq("owner_id", eventId);
  if (countError) throw normalizeSupabaseError(countError);

  const { data, error } = await supabase
    .from("event_schedule_items")
    .insert({
      workspace_id: event.workspace_id,
      owner_type: "event",
      owner_id: eventId,
      ...parsed.data,
      status: "planned",
      sort_order: count ?? 0,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const item = mapEventScheduleItemRow(data);
  await insertTimelineActivity(
    supabase,
    actor,
    event.workspace_id,
    "event",
    eventId,
    "schedule_item_created",
    `Schedule item created: "${item.title}"`,
  );

  return ok(item);
}

async function updateScheduleItem(id: string, input: ScheduleItemInput): Promise<DataResult<EventScheduleItem>> {
  const existing = await fetchScheduleItemRow(id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("event_schedule_items")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventScheduleItemRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "schedule_item_updated",
    `Schedule item updated: "${updated.title}"`,
  );

  return ok(updated);
}

async function updateScheduleItemStatus(id: string, status: ScheduleStatus): Promise<DataResult<EventScheduleItem>> {
  const existing = await fetchScheduleItemRow(id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("event_schedule_items")
    .update({ status })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapEventScheduleItemRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "schedule_item_updated",
    `Schedule item status changed to ${SCHEDULE_STATUS_LABELS[status]}: "${existing.title}"`,
  );

  return ok(updated);
}

async function deleteScheduleItem(id: string): Promise<DataResult<null>> {
  const existing = await fetchScheduleItemRow(id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const supabase = createSupabaseClient();
  const { error } = await supabase.from("event_schedule_items").delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);

  return ok(null);
}

async function reorderScheduleItems(eventId: string, orderedIds: string[]): Promise<DataResult<EventScheduleItem[]>> {
  const event = await fetchEventRow(eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const ownItems = await fetchScheduleItemsForEvent(event.workspace_id, eventId);
  if (orderedIds.length !== ownItems.length || !ownItems.every((item) => orderedIds.includes(item.id))) {
    return fail("The provided order doesn't match this event's schedule items.");
  }

  const supabase = createSupabaseClient();
  const { error } = await Promise.all(
    orderedIds.map((id, index) => supabase.from("event_schedule_items").update({ sort_order: index }).eq("id", id)),
  ).then((results) => {
    const failed = results.find((r) => r.error);
    return { error: failed?.error ?? null };
  });
  if (error) throw normalizeSupabaseError(error);

  return ok(await fetchScheduleItemsForEvent(event.workspace_id, eventId));
}

// ---------------------------------------------------------------------------
// Event Notes and Timeline
// ---------------------------------------------------------------------------

async function getNotesByEventId(eventId: string): Promise<Note[]> {
  const event = await fetchEventRow(eventId);
  if (!event) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", event.workspace_id)
    .eq("owner_type", "event")
    .eq("owner_id", eventId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapNoteRow);
}

async function createEventNote(eventId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const event = await fetchEventRow(eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: event.workspace_id,
      owner_type: "event",
      owner_id: eventId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await insertTimelineActivity(supabase, actor, event.workspace_id, "event", eventId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

async function togglePinEventNote(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data: noteRow, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("owner_type", "event")
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (fetchError) throw normalizeSupabaseError(fetchError);
  if (!noteRow) return null;

  const note = mapNoteRow(noteRow);
  const nextPinned = !note.is_pinned;
  const { data: updatedRow, error: updateError } = await supabase
    .from("notes")
    .update({ is_pinned: nextPinned })
    .eq("id", noteId)
    .eq("owner_type", "event")
    .eq("owner_id", note.owner_id)
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const updated = mapNoteRow(updatedRow);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    note.workspace_id,
    "event",
    note.owner_id,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${note.title}"`,
  );

  return ok(updated);
}

async function getTimelineByEventId(eventId: string): Promise<TimelineActivity[]> {
  const event = await fetchEventRow(eventId);
  if (!event) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", event.workspace_id)
    .eq("owner_type", "event")
    .eq("owner_id", eventId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapTimelineActivityRow);
}

/** Events doesn't exist yet, so hasPostEventReview is always false until that's built — same as the mock. */
async function getEventNextAction(eventId: string): Promise<string | null> {
  const [event, checklist, schedule] = await Promise.all([
    getEventById(eventId),
    getChecklistByEventId(eventId),
    getScheduleByEventId(eventId),
  ]);

  const now = Date.now();
  const daysUntilEvent = event.event_date
    ? Math.floor((new Date(event.event_date).getTime() - now) / (1000 * 60 * 60 * 24))
    : null;
  const hasOverdueChecklistItems = checklist.some(
    (item) =>
      item.status !== "completed" &&
      item.status !== "cancelled" &&
      item.due_date !== null &&
      new Date(item.due_date).getTime() < now,
  );

  return getEventNextRecommendedAction(event, {
    hasChecklistItems: checklist.length > 0,
    hasOverdueChecklistItems,
    hasScheduleItems: schedule.length > 0,
    hasPostEventReview: false,
    daysUntilEvent,
  });
}

export const supabaseEventsRepository: EventsRepository = {
  getEvents,
  getEventById,
  createEvent,
  updateEvent,
  updateEventStatus,
  updateEventLifecycleStage,
  updateEventPriority,
  archiveEvent,
  restoreEvent,
  cancelEvent,
  completeEvent,
  getEventNextAction,
  getChecklistByEventId,
  createChecklistItem,
  updateChecklistItem,
  updateChecklistItemStatus,
  completeChecklistItem,
  deleteChecklistItem,
  reorderChecklistItems,
  getScheduleByEventId,
  createScheduleItem,
  updateScheduleItem,
  updateScheduleItemStatus,
  deleteScheduleItem,
  reorderScheduleItems,
  getNotesByEventId,
  createEventNote,
  togglePinEventNote,
  getTimelineByEventId,
};
