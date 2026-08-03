import type { Event } from "@/types/event";
import type { ChecklistItem } from "@/types/checklistItem";
import type { EventScheduleItem } from "@/types/eventScheduleItem";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import { NotFoundError } from "@/core/errors";
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
import type { NoteFormInput } from "@/modules/notes/schema";
import { DEFAULT_CHECKLIST_TEMPLATES } from "@/modules/events/constants/checklistTemplates";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readClients } from "@/lib/data/mock/clientsStore";
import { readEvents, writeEvents } from "@/lib/data/mock/eventsStore";
import { readChecklistItems, writeChecklistItems } from "@/lib/data/mock/checklistStore";
import { readScheduleItems, writeScheduleItems } from "@/lib/data/mock/scheduleStore";
import { readNotes } from "@/lib/data/mock/notesStore";
import { writeNotes } from "@/lib/data/mock/notesStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { getNotesByOwner, createNoteForOwner, getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import type { EventFilters, EventsRepository } from "@/lib/data/events/repository";
import { getFullName } from "@/lib/personName";

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

async function getEvents(filters: EventFilters = {}): Promise<Event[]> {
  await delay(200);
  const {
    search,
    status,
    lifecycleStage,
    eventType,
    priority,
    clientId,
    dateFrom,
    dateTo,
    includeArchived = false,
  } = filters;
  const clientsById = new Map(readClients().map((client) => [client.id, client]));

  return readEvents().filter((event) => {
    if (!includeArchived && event.status === "archived") return false;
    if (status && status !== "all" && event.status !== status) return false;
    if (lifecycleStage && lifecycleStage !== "all" && event.lifecycle_stage !== lifecycleStage) return false;
    if (eventType && eventType !== "all" && event.event_type !== eventType) return false;
    if (priority && priority !== "all" && event.priority !== priority) return false;
    if (clientId && event.client_id !== clientId) return false;
    if (dateFrom || dateTo) {
      if (!event.event_date) return false;
      if (dateFrom && event.event_date < dateFrom) return false;
      if (dateTo && event.event_date > dateTo) return false;
    }
    if (search) {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const client = clientsById.get(event.client_id);
      const clientName = client ? getFullName(client) : "";
      const haystack = `${event.title} ${clientName} ${event.location_name ?? ""} ${event.city ?? ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

async function getEventById(id: string): Promise<Event> {
  await delay(150);
  const event = readEvents().find((e) => e.id === id);
  if (!event) {
    throw new NotFoundError(`Event ${id} was not found`);
  }
  return event;
}

/** Same atomic-batch rationale as lib/data/index.ts's original applyDefaultChecklistTemplate — extracted verbatim. */
/** Exported for test-only direct access (see lib/data/index.ts's __applyDefaultChecklistTemplateForTests) — never imported by UI. */
export async function applyDefaultChecklistTemplate(
  event: Event,
  templateItems: ChecklistItemInput[],
): Promise<DataResult<ChecklistItem[]>> {
  const parsedItems: ChecklistItemInput[] = [];
  for (const templateItem of templateItems) {
    const parsed = checklistItemSchema.safeParse(templateItem);
    if (!parsed.success) {
      return fail(
        "The default checklist template failed validation; no items were created.",
        fieldErrorsFromZod(parsed.error),
      );
    }
    parsedItems.push(parsed.data);
  }

  const timestamp = nowIso();
  const newItems: ChecklistItem[] = parsedItems.map((data, index) => ({
    id: generateId("checklist"),
    workspace_id: event.workspace_id,
    owner_type: "event",
    owner_id: event.id,
    ...data,
    status: "pending",
    completed_at: null,
    sort_order: index,
    created_at: timestamp,
    updated_at: timestamp,
  }));

  writeChecklistItems([...readChecklistItems(), ...newItems]);
  recordTimelineActivity(
    event.workspace_id,
    "event",
    event.id,
    "checklist_template_applied",
    `Default ${EVENT_TYPE_LABELS[event.event_type]} checklist created with ${newItems.length} item${newItems.length === 1 ? "" : "s"}.`,
  );

  return ok(newItems);
}

async function createEvent(input: EventFormInput): Promise<DataResult<Event>> {
  const parsed = eventDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }

  const timestamp = nowIso();
  const event: Event = {
    id: generateId("event"),
    workspace_id: client.workspace_id,
    ...parsed.data,
    status: "draft",
    lifecycle_stage: "intake",
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
    completed_at: null,
    cancelled_at: null,
  };

  writeEvents([...readEvents(), event]);
  recordTimelineActivity(event.workspace_id, "event", event.id, "event_created", "Event created");

  const defaultChecklist = DEFAULT_CHECKLIST_TEMPLATES[event.event_type];
  if (defaultChecklist) {
    await applyDefaultChecklistTemplate(event, defaultChecklist);
  }

  return ok(event);
}

async function updateEvent(id: string, input: EventFormInput): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }

  const parsed = eventDataSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const client = readClients().find((c) => c.id === parsed.data.client_id);
  if (!client) {
    return fail("Please select a valid client.", { client_id: "Client not found." });
  }

  const updated: Event = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_updated", "Event information updated");

  return ok(updated);
}

async function updateEventStatus(id: string, status: EventStatus): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (!canTransitionEventStatus(existing.status, status)) {
    return fail(
      `Cannot move an event from "${EVENT_STATUS_LABELS[existing.status]}" to "${EVENT_STATUS_LABELS[status]}".`,
    );
  }

  const updated: Event = { ...existing, status, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    id,
    "status_changed",
    `Status changed from ${EVENT_STATUS_LABELS[existing.status]} to ${EVENT_STATUS_LABELS[status]}`,
    { from: existing.status, to: status },
  );

  return ok(updated);
}

async function updateEventLifecycleStage(id: string, stage: EventLifecycleStage): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (!canTransitionLifecycleStage(existing.lifecycle_stage, stage)) {
    return fail(
      `Cannot move an event from "${EVENT_LIFECYCLE_STAGE_LABELS[existing.lifecycle_stage]}" to "${EVENT_LIFECYCLE_STAGE_LABELS[stage]}".`,
    );
  }

  const updated: Event = { ...existing, lifecycle_stage: stage, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    id,
    "lifecycle_stage_changed",
    `Lifecycle stage changed from ${EVENT_LIFECYCLE_STAGE_LABELS[existing.lifecycle_stage]} to ${EVENT_LIFECYCLE_STAGE_LABELS[stage]}`,
    { from: existing.lifecycle_stage, to: stage },
  );

  return ok(updated);
}

async function updateEventPriority(id: string, priority: EventPriority): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }

  const updated: Event = { ...existing, priority, updated_at: nowIso() };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    id,
    "priority_changed",
    `Priority changed from ${EVENT_PRIORITY_LABELS[existing.priority]} to ${EVENT_PRIORITY_LABELS[priority]}`,
    { from: existing.priority, to: priority },
  );

  return ok(updated);
}

async function archiveEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (existing.status === "archived") {
    return fail("This event is already archived.");
  }

  const timestamp = nowIso();
  const updated: Event = {
    ...existing,
    status: "archived",
    archived_at: timestamp,
    updated_at: timestamp,
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_archived", "Event archived");

  return ok(updated);
}

async function restoreEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (existing.status !== "archived") {
    return fail("This event is not archived.");
  }

  const updated: Event = {
    ...existing,
    status: "planning",
    archived_at: null,
    updated_at: nowIso(),
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_restored", "Event restored");

  return ok(updated);
}

async function cancelEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (isEventTerminal(existing.status)) {
    return fail(`This event is already ${EVENT_STATUS_LABELS[existing.status].toLowerCase()} and can't be cancelled.`);
  }

  const timestamp = nowIso();
  const updated: Event = {
    ...existing,
    status: "cancelled",
    cancelled_at: timestamp,
    updated_at: timestamp,
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_cancelled", "Event cancelled");

  return ok(updated);
}

async function completeEvent(id: string): Promise<DataResult<Event>> {
  const existing = readEvents().find((e) => e.id === id);
  if (!existing) {
    return fail("Event not found.");
  }
  if (isEventTerminal(existing.status)) {
    return fail(`This event is already ${EVENT_STATUS_LABELS[existing.status].toLowerCase()} and can't be completed.`);
  }

  const timestamp = nowIso();
  const updated: Event = {
    ...existing,
    status: "completed",
    completed_at: timestamp,
    updated_at: timestamp,
  };
  writeEvents(readEvents().map((e) => (e.id === id ? updated : e)));
  recordTimelineActivity(existing.workspace_id, "event", id, "event_completed", "Event completed");

  return ok(updated);
}

async function getChecklistByEventId(eventId: string): Promise<ChecklistItem[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  await delay(150);
  return readChecklistItems()
    .filter(
      (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

async function createChecklistItem(eventId: string, input: ChecklistItemInput): Promise<DataResult<ChecklistItem>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const ownItems = readChecklistItems().filter(
    (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );

  const timestamp = nowIso();
  const item: ChecklistItem = {
    id: generateId("checklist"),
    workspace_id: event.workspace_id,
    owner_type: "event",
    owner_id: eventId,
    ...parsed.data,
    status: "pending",
    completed_at: null,
    sort_order: ownItems.length,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeChecklistItems([...readChecklistItems(), item]);
  recordTimelineActivity(event.workspace_id, "event", eventId, "checklist_item_created", `Checklist item created: "${item.title}"`);

  return ok(item);
}

async function updateChecklistItem(id: string, input: ChecklistItemInput): Promise<DataResult<ChecklistItem>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }

  const parsed = checklistItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: ChecklistItem = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeChecklistItems(readChecklistItems().map((item) => (item.id === id ? updated : item)));

  return ok(updated);
}

async function updateChecklistItemStatus(id: string, status: ChecklistStatus): Promise<DataResult<ChecklistItem>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }

  const updated: ChecklistItem = {
    ...existing,
    status,
    completed_at: status === "completed" ? (existing.completed_at ?? nowIso()) : null,
    updated_at: nowIso(),
  };
  writeChecklistItems(readChecklistItems().map((item) => (item.id === id ? updated : item)));

  return ok(updated);
}

async function completeChecklistItem(id: string): Promise<DataResult<ChecklistItem>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }
  if (existing.status === "completed") {
    return fail("This checklist item is already completed.");
  }

  const timestamp = nowIso();
  const updated: ChecklistItem = {
    ...existing,
    status: "completed",
    completed_at: timestamp,
    updated_at: timestamp,
  };
  writeChecklistItems(readChecklistItems().map((item) => (item.id === id ? updated : item)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "checklist_item_completed",
    `Checklist item completed: "${existing.title}"`,
  );

  return ok(updated);
}

async function deleteChecklistItem(id: string): Promise<DataResult<null>> {
  const existing = readChecklistItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Checklist item not found.");
  }
  if (existing.status === "completed") {
    return fail("Completed checklist items can't be deleted.");
  }

  writeChecklistItems(readChecklistItems().filter((item) => item.id !== id));

  return ok(null);
}

async function reorderChecklistItems(eventId: string, orderedIds: string[]): Promise<DataResult<ChecklistItem[]>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const ownItems = readChecklistItems().filter(
    (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );
  if (orderedIds.length !== ownItems.length || !ownItems.every((item) => orderedIds.includes(item.id))) {
    return fail("The provided order doesn't match this event's checklist items.");
  }

  const timestamp = nowIso();
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  writeChecklistItems(
    readChecklistItems().map((item) =>
      order.has(item.id) ? { ...item, sort_order: order.get(item.id) as number, updated_at: timestamp } : item,
    ),
  );

  const updatedItems = readChecklistItems()
    .filter(
      (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  return ok(updatedItems);
}

async function getScheduleByEventId(eventId: string): Promise<EventScheduleItem[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  await delay(150);
  return readScheduleItems()
    .filter(
      (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);
}

async function createScheduleItem(eventId: string, input: ScheduleItemInput): Promise<DataResult<EventScheduleItem>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const ownItems = readScheduleItems().filter(
    (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );

  const timestamp = nowIso();
  const item: EventScheduleItem = {
    id: generateId("schedule"),
    workspace_id: event.workspace_id,
    owner_type: "event",
    owner_id: eventId,
    ...parsed.data,
    status: "planned",
    sort_order: ownItems.length,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeScheduleItems([...readScheduleItems(), item]);
  recordTimelineActivity(event.workspace_id, "event", eventId, "schedule_item_created", `Schedule item created: "${item.title}"`);

  return ok(item);
}

async function updateScheduleItem(id: string, input: ScheduleItemInput): Promise<DataResult<EventScheduleItem>> {
  const existing = readScheduleItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const parsed = scheduleItemSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const updated: EventScheduleItem = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeScheduleItems(readScheduleItems().map((item) => (item.id === id ? updated : item)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "schedule_item_updated",
    `Schedule item updated: "${updated.title}"`,
  );

  return ok(updated);
}

async function updateScheduleItemStatus(id: string, status: ScheduleStatus): Promise<DataResult<EventScheduleItem>> {
  const existing = readScheduleItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  const updated: EventScheduleItem = { ...existing, status, updated_at: nowIso() };
  writeScheduleItems(readScheduleItems().map((item) => (item.id === id ? updated : item)));
  recordTimelineActivity(
    existing.workspace_id,
    existing.owner_type,
    existing.owner_id,
    "schedule_item_updated",
    `Schedule item status changed to ${SCHEDULE_STATUS_LABELS[status]}: "${existing.title}"`,
  );

  return ok(updated);
}

async function deleteScheduleItem(id: string): Promise<DataResult<null>> {
  const existing = readScheduleItems().find((item) => item.id === id);
  if (!existing) {
    return fail("Schedule item not found.");
  }

  writeScheduleItems(readScheduleItems().filter((item) => item.id !== id));

  return ok(null);
}

async function reorderScheduleItems(eventId: string, orderedIds: string[]): Promise<DataResult<EventScheduleItem[]>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }

  const ownItems = readScheduleItems().filter(
    (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
  );
  if (orderedIds.length !== ownItems.length || !ownItems.every((item) => orderedIds.includes(item.id))) {
    return fail("The provided order doesn't match this event's schedule items.");
  }

  const timestamp = nowIso();
  const order = new Map(orderedIds.map((id, index) => [id, index]));
  writeScheduleItems(
    readScheduleItems().map((item) =>
      order.has(item.id) ? { ...item, sort_order: order.get(item.id) as number, updated_at: timestamp } : item,
    ),
  );

  const updatedItems = readScheduleItems()
    .filter(
      (item) => item.workspace_id === event.workspace_id && item.owner_type === "event" && item.owner_id === eventId,
    )
    .sort((a, b) => a.sort_order - b.sort_order);

  return ok(updatedItems);
}

async function getNotesByEventId(eventId: string): Promise<Note[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  return getNotesByOwner(event.workspace_id, "event", eventId);
}

async function createEventNote(eventId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) {
    return fail("Event not found.");
  }
  return createNoteForOwner(event.workspace_id, "event", eventId, input);
}

async function togglePinEventNote(noteId: string): Promise<DataResult<Note> | null> {
  const existing = readNotes().find((n) => n.id === noteId && n.owner_type === "event");
  if (!existing) return null;

  const updated: Note = {
    ...existing,
    is_pinned: !existing.is_pinned,
    updated_at: nowIso(),
  };
  writeNotes(readNotes().map((n) => (n.id === noteId ? updated : n)));
  recordTimelineActivity(
    existing.workspace_id,
    "event",
    existing.owner_id,
    updated.is_pinned ? "note_pinned" : "note_unpinned",
    `${updated.is_pinned ? "Note pinned" : "Note unpinned"}: "${existing.title}"`,
  );

  return ok(updated);
}

async function getTimelineByEventId(eventId: string): Promise<TimelineActivity[]> {
  const event = readEvents().find((e) => e.id === eventId);
  if (!event) return [];
  return getTimelineByOwner(event.workspace_id, "event", eventId);
}

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

export const mockEventsRepository: EventsRepository = {
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
