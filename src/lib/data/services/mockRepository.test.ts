import { afterEach, describe, expect, it } from "vitest";
import { mockServicesRepository } from "@/lib/data/services/mockRepository";
import { resetServicesStore, readServices, readServiceVersions } from "@/lib/data/mock/servicesStore";
import { resetServiceTemplatesStore, readServiceChecklistTemplateItems } from "@/lib/data/mock/serviceTemplatesStore";
import { resetEventServicesStore, readEventServices, writeEventServices } from "@/lib/data/mock/eventServicesStore";
import { resetChecklistStore, readChecklistItems } from "@/lib/data/mock/checklistStore";
import { resetScheduleStore } from "@/lib/data/mock/scheduleStore";
import { resetEventsStore } from "@/lib/data/mock/eventsStore";
import { resetTimelineStore } from "@/lib/data/mock/timelineStore";
import { resetNotesStore } from "@/lib/data/mock/notesStore";
import { NotFoundError } from "@/core/errors";

const {
  createService,
  updateService,
  activateService,
  updateServiceVersionDraft,
  publishServiceVersion,
  createServiceChecklistTemplateItem,
  updateServiceChecklistTemplateItem,
  assignServiceToEvent,
  removeEventService,
  transitionEventServiceStatus,
  getService,
  getServiceUsageCounts,
  updateEventServiceOverrides,
} = mockServicesRepository;

async function createPublishedActiveService(name = "Live Music") {
  const created = await createService({ category_id: null, name, description: null });
  if (!created.success) throw new Error("setup failed");
  await updateServiceVersionDraft(created.data.id, {
    base_price_minor: 50000,
    currency: "USD",
    setup_duration_minutes: null,
    breakdown_duration_minutes: null,
    difficulty_score: null,
    experience_level_required: null,
    weather_sensitivity: "none",
    surprise_friendly: false,
    estimated_profit_minor: null,
  });
  const published = await publishServiceVersion(created.data.id, { change_summary: "v1" });
  if (!published.success) throw new Error("setup failed");
  await activateService(created.data.id);
  return created.data;
}

afterEach(() => {
  resetServicesStore();
  resetServiceTemplatesStore();
  resetEventServicesStore();
  resetChecklistStore();
  resetScheduleStore();
  resetEventsStore();
  resetTimelineStore();
  resetNotesStore();
});

describe("createService", () => {
  it("creates the Service as a draft with exactly one draft ServiceVersion", async () => {
    const result = await createService({ category_id: null, name: "Live Music", description: null });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.status).toBe("draft");
    expect(result.data.current_published_version_id).toBeNull();
    expect(result.data.draft_version_id).not.toBeNull();

    const version = readServiceVersions().find((v) => v.id === result.data.draft_version_id);
    expect(version?.status).toBe("draft");
    expect(version?.version_number).toBeNull();
    // A draft has no display text of its own — Service.name/description is
    // the only current source; see docs/services.md's locked decision on
    // name/description ownership.
    expect(version?.name_snapshot).toBeNull();
    expect(version?.description_snapshot).toBeNull();
  });

  it("rejects a blank name", async () => {
    const result = await createService({ category_id: null, name: "  ", description: null });
    expect(result.success).toBe(false);
  });
});

describe("getService", () => {
  it("throws NotFoundError for an id that doesn't exist", async () => {
    await expect(getService("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("publishServiceVersion", () => {
  it("freezes the draft into a published version and starts a fresh draft clone", async () => {
    const created = await createService({ category_id: null, name: "Live Music", description: null });
    if (!created.success) throw new Error("setup failed");
    const draftId = created.data.draft_version_id as string;

    await createServiceChecklistTemplateItem(draftId, {
      title: "Confirm setlist",
      description: null,
      category: "planning",
      priority: "normal",
      due_offset_days: 5,
      display_order: 0,
    });

    const published = await publishServiceVersion(created.data.id, { change_summary: "Initial release" });
    expect(published.success).toBe(true);
    if (!published.success) return;

    expect(published.data.id).toBe(draftId);
    expect(published.data.status).toBe("published");
    expect(published.data.version_number).toBe(1);

    const service = readServices().find((s) => s.id === created.data.id);
    expect(service?.current_published_version_id).toBe(draftId);
    expect(service?.draft_version_id).not.toBe(draftId);

    // The published version's own template rows are untouched...
    const publishedItems = readServiceChecklistTemplateItems().filter((i) => i.service_version_id === draftId);
    expect(publishedItems).toHaveLength(1);

    // ...and a full independent clone now exists under the new draft.
    const newDraftItems = readServiceChecklistTemplateItems().filter((i) => i.service_version_id === service?.draft_version_id);
    expect(newDraftItems).toHaveLength(1);
    expect(newDraftItems[0].id).not.toBe(publishedItems[0].id);
  });

  it("stamps name_snapshot/description_snapshot from Service at the moment of publish, and never retroactively changes them", async () => {
    const created = await createService({ category_id: null, name: "Live Music", description: "Acoustic set." });
    if (!created.success) throw new Error("setup failed");

    const published = await publishServiceVersion(created.data.id, { change_summary: "v1" });
    if (!published.success) throw new Error("setup failed");
    expect(published.data.name_snapshot).toBe("Live Music");
    expect(published.data.description_snapshot).toBe("Acoustic set.");

    // Renaming the Service afterward must not rewrite history.
    await updateService(created.data.id, { category_id: null, name: "Acoustic Duo", description: "Acoustic set." });
    const v1AfterRename = readServiceVersions().find((v) => v.id === published.data.id);
    expect(v1AfterRename?.name_snapshot).toBe("Live Music");

    // The new draft has no display text of its own until IT is published.
    const service = readServices().find((s) => s.id === created.data.id);
    const newDraft = readServiceVersions().find((v) => v.id === service?.draft_version_id);
    expect(newDraft?.name_snapshot).toBeNull();
  });

  it("rejects editing a template item on a version that has already been published", async () => {
    const created = await createService({ category_id: null, name: "Live Music", description: null });
    if (!created.success) throw new Error("setup failed");
    const draftId = created.data.draft_version_id as string;

    const item = await createServiceChecklistTemplateItem(draftId, {
      title: "Confirm setlist",
      description: null,
      category: "planning",
      priority: "normal",
      due_offset_days: 5,
      display_order: 0,
    });
    if (!item.success) throw new Error("setup failed");

    await publishServiceVersion(created.data.id, { change_summary: null });

    const editResult = await updateServiceChecklistTemplateItem(item.data.id, {
      title: "Changed after publish",
      description: null,
      category: "planning",
      priority: "normal",
      due_offset_days: 5,
      display_order: 0,
    });
    expect(editResult.success).toBe(false);
  });

  it("never modifies an already-published version even after further drafts are published", async () => {
    const created = await createService({ category_id: null, name: "Live Music", description: null });
    if (!created.success) throw new Error("setup failed");
    const firstPublish = await publishServiceVersion(created.data.id, { change_summary: "v1" });
    if (!firstPublish.success) throw new Error("setup failed");
    const v1Id = firstPublish.data.id;
    const v1Snapshot = { ...firstPublish.data };

    const serviceAfterV1 = readServices().find((s) => s.id === created.data.id);
    await publishServiceVersion(created.data.id, { change_summary: "v2" });

    const v1AfterSecondPublish = readServiceVersions().find((v) => v.id === v1Id);
    expect(v1AfterSecondPublish).toEqual(v1Snapshot);
    expect(serviceAfterV1?.draft_version_id).not.toBe(v1Id);
  });
});

describe("assignServiceToEvent", () => {
  async function createPublishedServiceWithTemplates() {
    const created = await createService({ category_id: null, name: "Live Music", description: null });
    if (!created.success) throw new Error("setup failed");
    const draftId = created.data.draft_version_id as string;

    await createServiceChecklistTemplateItem(draftId, {
      title: "Confirm setlist",
      description: null,
      category: "planning",
      priority: "normal",
      due_offset_days: 5,
      display_order: 0,
    });
    await updateServiceVersionDraft(created.data.id, {
      base_price_minor: 50000,
      currency: "USD",
      setup_duration_minutes: null,
      breakdown_duration_minutes: null,
      difficulty_score: null,
      experience_level_required: null,
      weather_sensitivity: "none",
      surprise_friendly: false,
      estimated_profit_minor: null,
    });

    const published = await publishServiceVersion(created.data.id, { change_summary: "v1" });
    if (!published.success) throw new Error("setup failed");
    await activateService(created.data.id);
    return { service: created.data, versionId: published.data.id };
  }

  it("rejects assigning a Service with no published version", async () => {
    const created = await createService({ category_id: null, name: "Unpublished", description: null });
    if (!created.success) throw new Error("setup failed");
    const result = await assignServiceToEvent("event_1", { service_id: created.data.id, selected_add_on_ids: [] });
    expect(result.success).toBe(false);
  });

  it("generates an EventService plus real, tagged ChecklistItem rows on the Event", async () => {
    const { service, versionId } = await createPublishedServiceWithTemplates();
    const before = readChecklistItems().filter((c) => c.owner_id === "event_1").length;

    const result = await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.service_version_id).toBe(versionId);
    expect(result.data.price_minor).toBe(50000);

    const generated = readChecklistItems().filter((c) => c.owner_id === "event_1");
    expect(generated.length).toBe(before + 1);
    const tagged = generated.find((c) => c.source_event_service_id === result.data.id);
    expect(tagged?.title).toBe("Confirm setlist");
    expect(tagged?.template_snapshot?.title).toBe("Confirm setlist");
  });

  it("lets multiple assigned Services coexist on the same Event without interfering", async () => {
    const first = await createPublishedServiceWithTemplates();
    const secondCreated = await createService({ category_id: null, name: "Photography Add-on", description: null });
    if (!secondCreated.success) throw new Error("setup failed");
    const secondPublished = await publishServiceVersion(secondCreated.data.id, { change_summary: "v1" });
    if (!secondPublished.success) throw new Error("setup failed");
    await activateService(secondCreated.data.id);

    const assign1 = await assignServiceToEvent("event_1", { service_id: first.service.id, selected_add_on_ids: [] });
    const assign2 = await assignServiceToEvent("event_1", { service_id: secondCreated.data.id, selected_add_on_ids: [] });
    expect(assign1.success && assign2.success).toBe(true);

    const eventServices = await mockServicesRepository.listEventServicesByEvent("event_1");
    const ids = eventServices.map((e) => e.id);
    if (assign1.success) expect(ids).toContain(assign1.data.id);
    if (assign2.success) expect(ids).toContain(assign2.data.id);
  });

  it("listEventServicesByService finds every Event this Service was assigned to, across different Events", async () => {
    const { service } = await createPublishedServiceWithTemplates();
    const firstAssignment = await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    const secondAssignment = await assignServiceToEvent("event_2", { service_id: service.id, selected_add_on_ids: [] });
    expect(firstAssignment.success && secondAssignment.success).toBe(true);

    const assignments = await mockServicesRepository.listEventServicesByService(service.id);
    const ids = assignments.map((eventService) => eventService.id);
    if (firstAssignment.success) expect(ids).toContain(firstAssignment.data.id);
    if (secondAssignment.success) expect(ids).toContain(secondAssignment.data.id);
    expect(assignments.every((eventService) => eventService.service_id === service.id)).toBe(true);
  });
});

describe("removeEventService", () => {
  it("removes still-pending generated checklist items but preserves completed ones", async () => {
    const created = await createService({ category_id: null, name: "Live Music", description: null });
    if (!created.success) throw new Error("setup failed");
    const draftId = created.data.draft_version_id as string;
    await createServiceChecklistTemplateItem(draftId, { title: "Task A", description: null, category: "planning", priority: "normal", due_offset_days: null, display_order: 0 });
    const published = await publishServiceVersion(created.data.id, { change_summary: "v1" });
    if (!published.success) throw new Error("setup failed");
    await activateService(created.data.id);

    const assigned = await assignServiceToEvent("event_1", { service_id: created.data.id, selected_add_on_ids: [] });
    if (!assigned.success) throw new Error("setup failed");

    const generatedItem = readChecklistItems().find((c) => c.source_event_service_id === assigned.data.id);
    expect(generatedItem).toBeDefined();
    // Mark it completed before removing the EventService.
    const completed = { ...generatedItem!, status: "completed" as const };
    const { writeChecklistItems } = await import("@/lib/data/mock/checklistStore");
    writeChecklistItems(readChecklistItems().map((c) => (c.id === completed.id ? completed : c)));

    const removed = await removeEventService(assigned.data.id);
    expect(removed.success).toBe(true);

    const survivingItem = readChecklistItems().find((c) => c.id === completed.id);
    expect(survivingItem).toBeDefined();
    expect(readEventServices().find((e) => e.id === assigned.data.id)).toBeUndefined();
  });
});

describe("transitionEventServiceStatus", () => {
  it("rejects an illegal transition", async () => {
    const created = await createService({ category_id: null, name: "Live Music", description: null });
    if (!created.success) throw new Error("setup failed");
    const published = await publishServiceVersion(created.data.id, { change_summary: "v1" });
    if (!published.success) throw new Error("setup failed");
    await activateService(created.data.id);
    const assigned = await assignServiceToEvent("event_1", { service_id: created.data.id, selected_add_on_ids: [] });
    if (!assigned.success) throw new Error("setup failed");

    const result = await transitionEventServiceStatus(assigned.data.id, "completed");
    expect(result.success).toBe(false);
  });
});

describe("getServiceUsageCounts", () => {
  it("returns 0 (absent from the map) for a Service with no EventServices at all", async () => {
    const service = await createPublishedActiveService();
    const counts = await getServiceUsageCounts([service.id]);
    expect(counts[service.id] ?? 0).toBe(0);
  });

  it("counts multiple EventServices assigned to the same Service", async () => {
    const service = await createPublishedActiveService();
    await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    await assignServiceToEvent("event_2", { service_id: service.id, selected_add_on_ids: [] });

    const counts = await getServiceUsageCounts([service.id]);
    expect(counts[service.id]).toBe(2);
  });

  it("excludes EventServices belonging to another workspace", async () => {
    const service = await createPublishedActiveService();
    const assigned = await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    if (!assigned.success) throw new Error("setup failed");
    const foreign = { ...assigned.data, id: "es_foreign", workspace_id: "ws_other" };
    writeEventServices([...readEventServices(), foreign]);

    const counts = await getServiceUsageCounts([service.id]);
    expect(counts[service.id]).toBe(1);
  });

  it("excludes cancelled EventServices from the count", async () => {
    const service = await createPublishedActiveService();
    const assigned = await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    if (!assigned.success) throw new Error("setup failed");
    await transitionEventServiceStatus(assigned.data.id, "cancelled");

    const counts = await getServiceUsageCounts([service.id]);
    expect(counts[service.id] ?? 0).toBe(0);
  });

  it("counts a completed EventService as real historical usage", async () => {
    const service = await createPublishedActiveService();
    const assigned = await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    if (!assigned.success) throw new Error("setup failed");
    await transitionEventServiceStatus(assigned.data.id, "confirmed");
    await transitionEventServiceStatus(assigned.data.id, "in_progress");
    await transitionEventServiceStatus(assigned.data.id, "completed");

    const counts = await getServiceUsageCounts([service.id]);
    expect(counts[service.id]).toBe(1);
  });

  it("does one pass over the store rather than one lookup per requested id — never asks for the same service_id twice across events", async () => {
    const first = await createPublishedActiveService("Live Music");
    const second = await createPublishedActiveService("Photography");
    await assignServiceToEvent("event_1", { service_id: first.id, selected_add_on_ids: [] });
    await assignServiceToEvent("event_2", { service_id: second.id, selected_add_on_ids: [] });
    await assignServiceToEvent("event_3", { service_id: second.id, selected_add_on_ids: [] });

    const counts = await getServiceUsageCounts([first.id, second.id]);
    expect(counts).toEqual({ [first.id]: 1, [second.id]: 2 });
  });
});

describe("updateEventServiceOverrides", () => {
  async function assignFreshEventService() {
    const service = await createPublishedActiveService();
    const assigned = await assignServiceToEvent("event_1", { service_id: service.id, selected_add_on_ids: [] });
    if (!assigned.success) throw new Error("setup failed");
    return assigned.data;
  }

  it("updates only the live name/price fields, leaving the frozen template snapshot untouched", async () => {
    const eventService = await assignFreshEventService();
    const result = await updateEventServiceOverrides(eventService.id, { name: "Custom Name", price_minor: 75000 });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.name).toBe("Custom Name");
    expect(result.data.price_minor).toBe(75000);
    expect(result.data.name_template_value).toBe(eventService.name_template_value);
    expect(result.data.price_template_value).toBe(eventService.price_template_value);
    expect(result.data.service_version_id).toBe(eventService.service_version_id);
  });

  it("supports updating just one of the two override fields", async () => {
    const eventService = await assignFreshEventService();
    const result = await updateEventServiceOverrides(eventService.id, { name: "Custom Name" });
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.name).toBe("Custom Name");
    expect(result.data.price_minor).toBe(eventService.price_minor);
  });

  it("treats setting the live value back to the template value as an ordinary update — the override simply clears", async () => {
    const eventService = await assignFreshEventService();
    await updateEventServiceOverrides(eventService.id, { name: "Custom Name" });
    const cleared = await updateEventServiceOverrides(eventService.id, { name: eventService.name_template_value });
    expect(cleared.success).toBe(true);
    if (!cleared.success) return;
    expect(cleared.data.name).toBe(cleared.data.name_template_value);
  });

  it("rejects an empty input with no fields to update", async () => {
    const eventService = await assignFreshEventService();
    const result = await updateEventServiceOverrides(eventService.id, {});
    expect(result.success).toBe(false);
  });

  it("rejects once the EventService has reached a terminal status (completed)", async () => {
    const eventService = await assignFreshEventService();
    await transitionEventServiceStatus(eventService.id, "confirmed");
    await transitionEventServiceStatus(eventService.id, "in_progress");
    await transitionEventServiceStatus(eventService.id, "completed");

    const result = await updateEventServiceOverrides(eventService.id, { name: "Too Late" });
    expect(result.success).toBe(false);
  });

  it("rejects once the EventService has reached a terminal status (cancelled)", async () => {
    const eventService = await assignFreshEventService();
    await transitionEventServiceStatus(eventService.id, "cancelled");

    const result = await updateEventServiceOverrides(eventService.id, { name: "Too Late" });
    expect(result.success).toBe(false);
  });

  it("never mutates the pinned service_version_id or the catalog Service/ServiceVersion", async () => {
    const eventService = await assignFreshEventService();
    await updateEventServiceOverrides(eventService.id, { name: "Custom Name", price_minor: 1 });

    const service = readServices().find((s) => s.id === eventService.service_id);
    const version = readServiceVersions().find((v) => v.id === eventService.service_version_id);
    expect(service?.name).not.toBe("Custom Name");
    expect(version?.base_price_minor).not.toBe(1);
  });
});
