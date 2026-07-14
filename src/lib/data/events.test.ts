import { beforeEach, describe, expect, it } from "vitest";
import {
  archiveEvent,
  cancelEvent,
  completeChecklistItem,
  completeEvent,
  convertLeadToClient,
  createChecklistItem,
  createEvent,
  createEventNote,
  createLead,
  createScheduleItem,
  deleteChecklistItem,
  deleteScheduleItem,
  getChecklistByEventId,
  getDashboardMetrics,
  getEventById,
  getEventNextAction,
  getEvents,
  getNotesByEventId,
  getScheduleByEventId,
  getTimelineByEventId,
  reorderChecklistItems,
  reorderScheduleItems,
  resetAllMockData,
  restoreEvent,
  updateChecklistItem,
  updateChecklistItemStatus,
  updateEvent,
  updateEventLifecycleStage,
  updateEventPriority,
  updateEventStatus,
  updateScheduleItem,
  updateScheduleItemStatus,
  __applyDefaultChecklistTemplateForTests,
} from "@/lib/data";
import type { EventFormInput } from "@/modules/events/schema";
import type { ChecklistItemInput } from "@/modules/checklist/schema";
import type { ScheduleItemInput } from "@/modules/events/schema";
import type { LeadFormInput } from "@/modules/leads/schema";

/**
 * event_type is deliberately "birthday" — one of the types with no default
 * checklist template (see modules/events/constants/checklistTemplates.ts) —
 * so tests below that assume a blank checklist/schedule slate aren't
 * disturbed by template auto-population. Template behavior itself is
 * covered by its own dedicated describe block further down.
 */
const validEventInput: EventFormInput = {
  client_id: "client_1",
  originating_lead_id: "",
  title: "Test Event",
  event_type: "birthday",
  event_date: "",
  start_time: "",
  end_time: "",
  timezone: "",
  location_name: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  latitude: "",
  longitude: "",
  guest_count: "",
  budget_min: "",
  budget_max: "",
  package_name: "",
  theme: "",
  color_palette: "",
  surprise_event: false,
  confidentiality_notes: "",
  accessibility_notes: "",
  dietary_notes: "",
  weather_plan: "",
  backup_location: "",
  internal_summary: "",
  assigned_owner: "",
  priority: "normal",
};

const validChecklistInput: ChecklistItemInput = {
  title: "Book photographer",
  description: null,
  category: "photography",
  priority: "high",
  due_date: null,
  assigned_type: "unknown",
  assigned_id: null,
  assigned_name: null,
};

const validScheduleInput: ScheduleItemInput = {
  title: "Team arrival",
  description: null,
  start_time: "17:00",
  end_time: "17:45",
  location: null,
  assigned_to: null,
  category: "arrival",
};

const validLeadInput: LeadFormInput = {
  first_name: "Taylor",
  last_name: "Morgan",
  email: "taylor.morgan@example.com",
  phone: "",
  instagram: "",
  source: "Website",
  event_type: "",
  event_date: "",
  location: "",
  budget_min: "",
  budget_max: "",
  message: "",
  assigned_to: "",
};

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

beforeEach(() => {
  resetAllMockData();
});

describe("createEvent", () => {
  it("creates an Event with draft status and intake lifecycle stage, records event_created", async () => {
    const result = await createEvent(validEventInput);
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("draft");
    expect(result.data.lifecycle_stage).toBe("intake");
    expect(result.data.client_id).toBe("client_1");
    expect(result.data.workspace_id).toBe("ws_amore_bloom");

    const timeline = await getTimelineByEventId(result.data.id);
    expect(timeline.some((activity) => activity.type === "event_created")).toBe(true);
  });

  it("fails with field errors for invalid input", async () => {
    const result = await createEvent({ ...validEventInput, title: "" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.title).toBeTruthy();
  });

  it("prevents creating an Event against a Client that doesn't exist", async () => {
    const result = await createEvent({ ...validEventInput, client_id: "client_does_not_exist" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.fieldErrors?.client_id).toBeTruthy();
  });
});

describe("createEvent default checklist templates", () => {
  it("auto-populates the proposal checklist template for a proposal event", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "proposal" });
    if (!created.success) throw new Error("setup failed");

    const checklist = await getChecklistByEventId(created.data.id);
    expect(checklist.length).toBe(11);
    expect(checklist.every((item) => item.status === "pending")).toBe(true);
    expect(checklist.some((item) => item.title === "Confirm ring")).toBe(true);
    expect(checklist.map((item) => item.sort_order)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("auto-populates the hotel decoration checklist template", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "hotel_decoration" });
    if (!created.success) throw new Error("setup failed");

    const checklist = await getChecklistByEventId(created.data.id);
    expect(checklist.some((item) => item.title.includes("hotel key"))).toBe(true);
  });

  it("auto-populates the anniversary checklist template", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "anniversary" });
    if (!created.success) throw new Error("setup failed");

    const checklist = await getChecklistByEventId(created.data.id);
    expect(checklist.some((item) => item.title === "Confirm venue reservation")).toBe(true);
  });

  it("records exactly one summarized checklist_template_applied activity, not one per item", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "proposal" });
    if (!created.success) throw new Error("setup failed");

    const timeline = await getTimelineByEventId(created.data.id);
    const templateActivities = timeline.filter((activity) => activity.type === "checklist_template_applied");
    expect(templateActivities).toHaveLength(1);
    expect(templateActivities[0].description).toBe("Default Proposal checklist created with 11 items.");
  });

  it("does not record an individual checklist_item_created activity for auto-created template items", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "proposal" });
    if (!created.success) throw new Error("setup failed");

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.filter((activity) => activity.type === "checklist_item_created")).toHaveLength(0);
  });

  it("still records an individual checklist_item_created activity for a manually created item", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "proposal" });
    if (!created.success) throw new Error("setup failed");

    await createChecklistItem(created.data.id, validChecklistInput);

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.filter((activity) => activity.type === "checklist_item_created")).toHaveLength(1);
  });

  it("does not auto-populate a checklist, and records no checklist_template_applied activity, for an event type without a template", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "birthday" });
    if (!created.success) throw new Error("setup failed");

    const checklist = await getChecklistByEventId(created.data.id);
    expect(checklist).toEqual([]);

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "checklist_template_applied")).toBe(false);
  });

  it("the auto-populated checklist can still be edited and completed like any other item", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "picnic" });
    if (!created.success) throw new Error("setup failed");

    const checklist = await getChecklistByEventId(created.data.id);
    const first = checklist[0];
    const completed = await completeChecklistItem(first.id);
    expect(completed.success).toBe(true);
  });

  it("leaves no partial checklist records when template validation fails", async () => {
    const created = await createEvent({ ...validEventInput, event_type: "birthday" });
    if (!created.success) throw new Error("setup failed");

    const invalidTemplate: ChecklistItemInput[] = [
      validChecklistInput,
      { ...validChecklistInput, category: "not-a-real-category" as ChecklistItemInput["category"] },
      { ...validChecklistInput, title: "Never written" },
    ];

    const result = await __applyDefaultChecklistTemplateForTests(created.data, invalidTemplate);
    expect(result.success).toBe(false);

    const checklist = await getChecklistByEventId(created.data.id);
    expect(checklist).toEqual([]);

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "checklist_template_applied")).toBe(false);
  });
});

describe("Event creation from a converted Lead's Client", () => {
  it("preserves originating_lead_id on the Event", async () => {
    const lead = await createLead(validLeadInput);
    if (!lead.success) throw new Error("setup failed");

    const converted = await convertLeadToClient(lead.data.id);
    if (!converted.success) throw new Error("setup failed");

    const event = await createEvent({
      ...validEventInput,
      client_id: converted.data.client.id,
      originating_lead_id: lead.data.id,
    });
    expect(event.success).toBe(true);
    if (!event.success) return;

    expect(event.data.originating_lead_id).toBe(lead.data.id);
    expect(event.data.client_id).toBe(converted.data.client.id);
    expect(event.data.workspace_id).toBe(converted.data.client.workspace_id);

    const stored = await getEventById(event.data.id);
    expect(stored.originating_lead_id).toBe(lead.data.id);
  });

  it("does not require originating_lead_id for a manually created Event", async () => {
    const result = await createEvent(validEventInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.originating_lead_id).toBeNull();
  });
});

describe("updateEvent", () => {
  it("edits fields and records event_updated", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateEvent(created.data.id, {
      ...validEventInput,
      title: "Updated Title",
      theme: "Coastal minimal",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Updated Title");
    expect(result.data.theme).toBe("Coastal minimal");

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "event_updated")).toBe(true);
  });

  it("fails for an event that doesn't exist", async () => {
    const result = await updateEvent("event_does_not_exist", validEventInput);
    expect(result.success).toBe(false);
  });
});

describe("Event status behavior", () => {
  it("updateEventStatus changes status and records status_changed", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateEventStatus(created.data.id, "inquiry");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("inquiry");

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "status_changed")).toBe(true);
  });

  it("refuses to transition directly into completed/cancelled/archived via updateEventStatus", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateEventStatus(created.data.id, "completed");
    expect(result.success).toBe(false);
  });

  it("archiveEvent stamps archived_at and records event_archived", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await archiveEvent(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("archived");
    expect(result.data.archived_at).not.toBeNull();

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "event_archived")).toBe(true);
  });

  it("refuses to archive an already-archived event", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await archiveEvent(created.data.id);

    const second = await archiveEvent(created.data.id);
    expect(second.success).toBe(false);
  });

  it("restoreEvent clears archived_at and records event_restored", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await archiveEvent(created.data.id);

    const result = await restoreEvent(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.archived_at).toBeNull();
    expect(result.data.status).toBe("planning");

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "event_restored")).toBe(true);
  });

  it("refuses to restore an event that isn't archived", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await restoreEvent(created.data.id);
    expect(result.success).toBe(false);
  });

  it("cancelEvent stamps cancelled_at and records event_cancelled", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await cancelEvent(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("cancelled");
    expect(result.data.cancelled_at).not.toBeNull();

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "event_cancelled")).toBe(true);
  });

  it("refuses to cancel an already-completed event", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await completeEvent(created.data.id);

    const result = await cancelEvent(created.data.id);
    expect(result.success).toBe(false);
  });

  it("completeEvent stamps completed_at and records event_completed", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await completeEvent(created.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("completed");
    expect(result.data.completed_at).not.toBeNull();

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "event_completed")).toBe(true);
  });

  it("refuses to complete an already-cancelled event", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await cancelEvent(created.data.id);

    const result = await completeEvent(created.data.id);
    expect(result.success).toBe(false);
  });
});

describe("updateEventLifecycleStage", () => {
  it("changes lifecycle_stage and records lifecycle_stage_changed", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateEventLifecycleStage(created.data.id, "planning");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lifecycle_stage).toBe("planning");

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "lifecycle_stage_changed")).toBe(true);
  });

  it("refuses any transition once closed", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await updateEventLifecycleStage(created.data.id, "closed");

    const result = await updateEventLifecycleStage(created.data.id, "planning");
    expect(result.success).toBe(false);
  });
});

describe("updateEventPriority", () => {
  it("changes priority and records priority_changed", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateEventPriority(created.data.id, "critical");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priority).toBe("critical");

    const timeline = await getTimelineByEventId(created.data.id);
    expect(timeline.some((activity) => activity.type === "priority_changed")).toBe(true);
  });

  it("supports the new urgent priority tier, between high and critical", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const result = await updateEventPriority(created.data.id, "urgent");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.priority).toBe("urgent");
  });
});

describe("expanded EventType values", () => {
  it.each([
    "bridal_shower",
    "baby_shower",
    "elopement",
    "styled_shoot",
    "branding",
    "photoshoot",
  ] as const)("accepts the new event_type \"%s\"", async (eventType) => {
    const result = await createEvent({ ...validEventInput, event_type: eventType });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.event_type).toBe(eventType);
  });

  it("still accepts every original event_type", async () => {
    const result = await createEvent({ ...validEventInput, event_type: "romantic_setup" });
    expect(result.success).toBe(true);
  });
});

describe("getEvents filtering", () => {
  it("excludes archived events by default", async () => {
    const before = await getEvents();
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await archiveEvent(created.data.id);

    const after = await getEvents();
    expect(after.length).toBe(before.length);
    expect(after.some((event) => event.id === created.data.id)).toBe(false);
  });

  it("includes archived events when includeArchived is true", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await archiveEvent(created.data.id);

    const results = await getEvents({ includeArchived: true });
    expect(results.some((event) => event.id === created.data.id)).toBe(true);
  });

  it("filters by clientId", async () => {
    const results = await getEvents({ clientId: "client_1" });
    expect(results.every((event) => event.client_id === "client_1")).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it("filters by status", async () => {
    const results = await getEvents({ status: "draft" });
    expect(results.every((event) => event.status === "draft")).toBe(true);
  });

  it("filters by search text across title and city", async () => {
    const created = await createEvent({ ...validEventInput, title: "Very Unique Picnic Title" });
    if (!created.success) throw new Error("setup failed");

    const results = await getEvents({ search: "very unique picnic" });
    expect(results.some((event) => event.id === created.data.id)).toBe(true);

    const noMatch = await getEvents({ search: "no-such-event-xyz" });
    expect(noMatch.length).toBe(0);
  });
});

describe("Checklist CRUD", () => {
  it("createChecklistItem assigns sequential sort_order and records checklist_item_created", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");

    const first = await createChecklistItem(event.data.id, validChecklistInput);
    const second = await createChecklistItem(event.data.id, { ...validChecklistInput, title: "Order florals" });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    expect(first.data.sort_order).toBe(0);
    expect(second.data.sort_order).toBe(1);
    expect(first.data.status).toBe("pending");

    const timeline = await getTimelineByEventId(event.data.id);
    expect(timeline.filter((activity) => activity.type === "checklist_item_created")).toHaveLength(2);
  });

  it("updateChecklistItem edits fields", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const item = await createChecklistItem(event.data.id, validChecklistInput);
    if (!item.success) throw new Error("setup failed");

    const result = await updateChecklistItem(item.data.id, {
      ...validChecklistInput,
      title: "Book photographer (confirmed)",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Book photographer (confirmed)");
  });

  it("updateChecklistItemStatus sets and clears completed_at", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const item = await createChecklistItem(event.data.id, validChecklistInput);
    if (!item.success) throw new Error("setup failed");

    const completed = await updateChecklistItemStatus(item.data.id, "completed");
    expect(completed.success).toBe(true);
    if (completed.success) expect(completed.data.completed_at).not.toBeNull();

    const reopened = await updateChecklistItemStatus(item.data.id, "pending");
    expect(reopened.success).toBe(true);
    if (reopened.success) expect(reopened.data.completed_at).toBeNull();
  });

  it("completeChecklistItem records checklist_item_completed and refuses to double-complete", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const item = await createChecklistItem(event.data.id, validChecklistInput);
    if (!item.success) throw new Error("setup failed");

    const result = await completeChecklistItem(item.data.id);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("completed");

    const timeline = await getTimelineByEventId(event.data.id);
    expect(timeline.some((activity) => activity.type === "checklist_item_completed")).toBe(true);

    const second = await completeChecklistItem(item.data.id);
    expect(second.success).toBe(false);
  });

  it("deleteChecklistItem succeeds for a pending item but refuses a completed one", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const pending = await createChecklistItem(event.data.id, validChecklistInput);
    const toComplete = await createChecklistItem(event.data.id, { ...validChecklistInput, title: "Order florals" });
    if (!pending.success || !toComplete.success) throw new Error("setup failed");
    await completeChecklistItem(toComplete.data.id);

    const deletedPending = await deleteChecklistItem(pending.data.id);
    expect(deletedPending.success).toBe(true);

    const deletedCompleted = await deleteChecklistItem(toComplete.data.id);
    expect(deletedCompleted.success).toBe(false);

    const remaining = await getChecklistByEventId(event.data.id);
    expect(remaining.some((i) => i.id === pending.data.id)).toBe(false);
    expect(remaining.some((i) => i.id === toComplete.data.id)).toBe(true);
  });

  it("reorderChecklistItems reassigns sort_order to match the given order", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const a = await createChecklistItem(event.data.id, { ...validChecklistInput, title: "A" });
    const b = await createChecklistItem(event.data.id, { ...validChecklistInput, title: "B" });
    const c = await createChecklistItem(event.data.id, { ...validChecklistInput, title: "C" });
    if (!a.success || !b.success || !c.success) throw new Error("setup failed");

    const result = await reorderChecklistItems(event.data.id, [c.data.id, a.data.id, b.data.id]);
    expect(result.success).toBe(true);

    const ordered = await getChecklistByEventId(event.data.id);
    expect(ordered.map((i) => i.id)).toEqual([c.data.id, a.data.id, b.data.id]);
  });

  it("reorderChecklistItems fails if the id set doesn't match the event's items", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    await createChecklistItem(event.data.id, validChecklistInput);

    const result = await reorderChecklistItems(event.data.id, ["not_a_real_id"]);
    expect(result.success).toBe(false);
  });

  it("supports generalized assignment (assigned_type/assigned_id/assigned_name) instead of a single assigned_to string", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");

    const result = await createChecklistItem(event.data.id, {
      ...validChecklistInput,
      assigned_type: "vendor",
      assigned_id: null,
      assigned_name: "Golden Gate Florals",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.assigned_type).toBe("vendor");
    expect(result.data.assigned_name).toBe("Golden Gate Florals");
  });
});

describe("Schedule CRUD", () => {
  it("createScheduleItem assigns sequential sort_order and records schedule_item_created", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");

    const first = await createScheduleItem(event.data.id, validScheduleInput);
    const second = await createScheduleItem(event.data.id, { ...validScheduleInput, title: "Breakdown" });
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.data.sort_order).toBe(0);
    expect(second.data.sort_order).toBe(1);
    expect(first.data.status).toBe("planned");

    const timeline = await getTimelineByEventId(event.data.id);
    expect(timeline.filter((activity) => activity.type === "schedule_item_created")).toHaveLength(2);
  });

  it("updateScheduleItem edits fields and records schedule_item_updated", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const item = await createScheduleItem(event.data.id, validScheduleInput);
    if (!item.success) throw new Error("setup failed");

    const result = await updateScheduleItem(item.data.id, { ...validScheduleInput, title: "Team arrival (revised)" });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Team arrival (revised)");

    const timeline = await getTimelineByEventId(event.data.id);
    expect(timeline.some((activity) => activity.type === "schedule_item_updated")).toBe(true);
  });

  it("updateScheduleItemStatus changes status", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const item = await createScheduleItem(event.data.id, validScheduleInput);
    if (!item.success) throw new Error("setup failed");

    const result = await updateScheduleItemStatus(item.data.id, "delayed");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.status).toBe("delayed");
  });

  it("deleteScheduleItem removes the item", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const item = await createScheduleItem(event.data.id, validScheduleInput);
    if (!item.success) throw new Error("setup failed");

    const result = await deleteScheduleItem(item.data.id);
    expect(result.success).toBe(true);

    const remaining = await getScheduleByEventId(event.data.id);
    expect(remaining.some((i) => i.id === item.data.id)).toBe(false);
  });

  it("reorderScheduleItems reassigns sort_order to match the given order", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    const a = await createScheduleItem(event.data.id, { ...validScheduleInput, title: "A" });
    const b = await createScheduleItem(event.data.id, { ...validScheduleInput, title: "B" });
    if (!a.success || !b.success) throw new Error("setup failed");

    const result = await reorderScheduleItems(event.data.id, [b.data.id, a.data.id]);
    expect(result.success).toBe(true);

    const ordered = await getScheduleByEventId(event.data.id);
    expect(ordered.map((i) => i.id)).toEqual([b.data.id, a.data.id]);
  });

  it("stores generalized ownership (owner_type/owner_id) instead of a plain event_id", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");

    const result = await createScheduleItem(event.data.id, validScheduleInput);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.owner_type).toBe("event");
    expect(result.data.owner_id).toBe(event.data.id);
    expect(result.data.workspace_id).toBe(event.data.workspace_id);
  });
});

describe("Event notes", () => {
  it("adds a note and records note_added on the event's own timeline", async () => {
    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");

    const note = await createEventNote(event.data.id, {
      title: "Allergy",
      content: "Peanut allergy",
      category: "allergy",
      priority: "critical",
    });
    expect(note.success).toBe(true);

    const timeline = await getTimelineByEventId(event.data.id);
    expect(timeline.some((activity) => activity.type === "note_added")).toBe(true);

    const notes = await getNotesByEventId(event.data.id);
    expect(notes.some((n) => n.title === "Allergy")).toBe(true);
  });
});

describe("Workspace isolation across owners", () => {
  it("scopes checklist, schedule, notes, and timeline strictly to their own Event", async () => {
    const eventA = await createEvent(validEventInput);
    const eventB = await createEvent({ ...validEventInput, title: "Second Event" });
    if (!eventA.success || !eventB.success) throw new Error("setup failed");

    await createChecklistItem(eventA.data.id, validChecklistInput);
    await createScheduleItem(eventA.data.id, validScheduleInput);
    await createEventNote(eventA.data.id, {
      title: "A only",
      content: "Only on event A",
      category: "general",
      priority: "normal",
    });

    expect(await getChecklistByEventId(eventB.data.id)).toEqual([]);
    expect(await getScheduleByEventId(eventB.data.id)).toEqual([]);
    expect(await getNotesByEventId(eventB.data.id)).toEqual([]);

    const timelineB = await getTimelineByEventId(eventB.data.id);
    expect(timelineB.every((activity) => activity.owner_id === eventB.data.id)).toBe(true);
    expect(timelineB.some((activity) => activity.type === "checklist_item_created")).toBe(false);

    const checklistA = await getChecklistByEventId(eventA.data.id);
    expect(checklistA.every((item) => item.workspace_id === eventA.data.workspace_id)).toBe(true);
    expect(checklistA.every((item) => item.owner_id === eventA.data.id)).toBe(true);
  });
});

describe("getEventNextAction", () => {
  it("recommends completing details for a freshly created draft event", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");

    const action = await getEventNextAction(created.data.id);
    expect(action).toMatch(/draft/i);
  });

  it("returns null for an archived event", async () => {
    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await archiveEvent(created.data.id);

    const action = await getEventNextAction(created.data.id);
    expect(action).toBeNull();
  });
});

describe("getEventById", () => {
  it("throws NotFoundError for a missing event", async () => {
    await expect(getEventById("does_not_exist")).rejects.toThrow();
  });
});

describe("Dashboard Event metrics", () => {
  it("exposes every required Event metric label with a numeric value", async () => {
    const metrics = await getDashboardMetrics();
    const requiredLabels = [
      "Upcoming Events",
      "Events This Week",
      "Events Awaiting Contract",
      "Events Awaiting Deposit",
      "Events In Planning",
      "Events Ready",
      "Events Completed This Month",
      "Critical Events",
      "Overdue Checklist Items",
      "Today's Events",
      "Tomorrow's Events",
      "Weekend Events",
    ];

    for (const label of requiredLabels) {
      const metric = metrics.find((m) => m.label === label);
      expect(metric, `missing metric "${label}"`).toBeDefined();
      expect(Number.isNaN(Number(metric?.value))).toBe(false);
      expect(metric?.href).toBe("/events");
    }
  });

  it("exposes Checklist Completion % as a percentage string", async () => {
    const metrics = await getDashboardMetrics();
    const metric = metrics.find((m) => m.label === "Checklist Completion %");
    expect(metric).toBeDefined();
    expect(metric?.value === "—" || /^\d+%$/.test(metric?.value ?? "")).toBe(true);
  });

  it("exposes Weather Alert and Assigned Staff % as documented placeholders", async () => {
    const metrics = await getDashboardMetrics();
    expect(metrics.find((m) => m.label === "Weather Alert")?.value).toBe("—");
    expect(metrics.find((m) => m.label === "Assigned Staff %")?.value).toBe("—");
  });

  it("counts an event happening today toward Today's Events", async () => {
    const before = await getDashboardMetrics();
    const beforeCount = Number(before.find((m) => m.label === "Today's Events")?.value);

    const created = await createEvent({ ...validEventInput, event_date: daysFromNow(0) });
    expect(created.success).toBe(true);

    const after = await getDashboardMetrics();
    const afterCount = Number(after.find((m) => m.label === "Today's Events")?.value);
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("counts an event happening tomorrow toward Tomorrow's Events", async () => {
    const before = await getDashboardMetrics();
    const beforeCount = Number(before.find((m) => m.label === "Tomorrow's Events")?.value);

    const created = await createEvent({ ...validEventInput, event_date: daysFromNow(1) });
    expect(created.success).toBe(true);

    const after = await getDashboardMetrics();
    const afterCount = Number(after.find((m) => m.label === "Tomorrow's Events")?.value);
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("increases Checklist Completion % after completing every checklist item on a fresh event", async () => {
    const event = await createEvent({ ...validEventInput, event_type: "proposal" });
    if (!event.success) throw new Error("setup failed");
    const checklist = await getChecklistByEventId(event.data.id);
    for (const checklistItem of checklist) {
      await completeChecklistItem(checklistItem.id);
    }

    const metrics = await getDashboardMetrics();
    const metric = metrics.find((m) => m.label === "Checklist Completion %");
    expect(metric?.value).not.toBe("—");
    expect(Number(metric?.value.replace("%", ""))).toBeGreaterThan(0);
  });

  it("counts a newly created event within 7 days toward Events This Week", async () => {
    const before = await getDashboardMetrics();
    const beforeCount = Number(before.find((m) => m.label === "Events This Week")?.value);

    const created = await createEvent({ ...validEventInput, event_date: daysFromNow(3) });
    expect(created.success).toBe(true);

    const after = await getDashboardMetrics();
    const afterCount = Number(after.find((m) => m.label === "Events This Week")?.value);
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("counts a critical-priority active event toward Critical Events", async () => {
    const before = await getDashboardMetrics();
    const beforeCount = Number(before.find((m) => m.label === "Critical Events")?.value);

    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await updateEventPriority(created.data.id, "critical");

    const after = await getDashboardMetrics();
    const afterCount = Number(after.find((m) => m.label === "Critical Events")?.value);
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("counts a checklist item overdue in the past toward Overdue Checklist Items", async () => {
    const before = await getDashboardMetrics();
    const beforeCount = Number(before.find((m) => m.label === "Overdue Checklist Items")?.value);

    const event = await createEvent(validEventInput);
    if (!event.success) throw new Error("setup failed");
    await createChecklistItem(event.data.id, { ...validChecklistInput, due_date: daysFromNow(-3) });

    const after = await getDashboardMetrics();
    const afterCount = Number(after.find((m) => m.label === "Overdue Checklist Items")?.value);
    expect(afterCount).toBe(beforeCount + 1);
  });

  it("counts an event completed today toward Events Completed This Month", async () => {
    const before = await getDashboardMetrics();
    const beforeCount = Number(before.find((m) => m.label === "Events Completed This Month")?.value);

    const created = await createEvent(validEventInput);
    if (!created.success) throw new Error("setup failed");
    await completeEvent(created.data.id);

    const after = await getDashboardMetrics();
    const afterCount = Number(after.find((m) => m.label === "Events Completed This Month")?.value);
    expect(afterCount).toBe(beforeCount + 1);
  });
});

describe("existing Lead and Client behavior is untouched", () => {
  it("still creates a Lead successfully", async () => {
    const result = await createLead(validLeadInput);
    expect(result.success).toBe(true);
  });

  it("still converts a Lead to a Client successfully", async () => {
    const lead = await createLead(validLeadInput);
    if (!lead.success) throw new Error("setup failed");
    const result = await convertLeadToClient(lead.data.id);
    expect(result.success).toBe(true);
  });
});
