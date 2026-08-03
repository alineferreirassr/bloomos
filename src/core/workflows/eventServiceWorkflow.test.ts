import { describe, expect, it } from "vitest";
import {
  canTransitionEventServiceStatus,
  isGeneratedChecklistItemRemovable,
  isGeneratedScheduleItemRemovable,
  resolveOffsetTime,
  resolveOffsetDueDate,
  computeServicePrice,
  computeServiceRequirements,
  buildEventServiceAssignmentPlan,
} from "@/core/workflows/eventServiceWorkflow";

describe("canTransitionEventServiceStatus", () => {
  it("allows the normal forward lifecycle", () => {
    expect(canTransitionEventServiceStatus("proposed", "confirmed")).toBe(true);
    expect(canTransitionEventServiceStatus("confirmed", "in_progress")).toBe(true);
    expect(canTransitionEventServiceStatus("in_progress", "completed")).toBe(true);
  });
  it("allows cancelling from any non-terminal status", () => {
    expect(canTransitionEventServiceStatus("proposed", "cancelled")).toBe(true);
    expect(canTransitionEventServiceStatus("confirmed", "cancelled")).toBe(true);
  });
  it("rejects any transition out of a terminal status", () => {
    expect(canTransitionEventServiceStatus("completed", "in_progress")).toBe(false);
    expect(canTransitionEventServiceStatus("cancelled", "proposed")).toBe(false);
  });
  it("rejects transitioning to the same status", () => {
    expect(canTransitionEventServiceStatus("confirmed", "confirmed")).toBe(false);
  });
});

describe("isGeneratedChecklistItemRemovable / isGeneratedScheduleItemRemovable", () => {
  it("only a pending checklist item is removable", () => {
    expect(isGeneratedChecklistItemRemovable("pending")).toBe(true);
    expect(isGeneratedChecklistItemRemovable("completed")).toBe(false);
    expect(isGeneratedChecklistItemRemovable("in_progress")).toBe(false);
  });
  it("only a planned schedule item is removable", () => {
    expect(isGeneratedScheduleItemRemovable("planned")).toBe(true);
    expect(isGeneratedScheduleItemRemovable("completed")).toBe(false);
    expect(isGeneratedScheduleItemRemovable("confirmed")).toBe(false);
  });
});

describe("resolveOffsetTime", () => {
  it("resolves a positive offset forward from the base time", () => {
    expect(resolveOffsetTime("15:00", 30)).toBe("15:30");
  });
  it("resolves a negative offset backward from the base time", () => {
    expect(resolveOffsetTime("15:00", -60)).toBe("14:00");
  });
  it("wraps around midnight", () => {
    expect(resolveOffsetTime("23:30", 60)).toBe("00:30");
    expect(resolveOffsetTime("00:15", -30)).toBe("23:45");
  });
  it("returns null when there is no base time to anchor to", () => {
    expect(resolveOffsetTime(null, 30)).toBeNull();
  });
  it("returns null for a malformed base time rather than throwing", () => {
    expect(resolveOffsetTime("not-a-time", 30)).toBeNull();
  });
});

describe("resolveOffsetDueDate", () => {
  it("counts offset days before the Event date", () => {
    expect(resolveOffsetDueDate("2026-08-15", 7)).toBe("2026-08-08");
  });
  it("returns null when there is no Event date", () => {
    expect(resolveOffsetDueDate(null, 7)).toBeNull();
  });
  it("returns null when there is no offset at all", () => {
    expect(resolveOffsetDueDate("2026-08-15", null)).toBeNull();
  });
});

describe("computeServicePrice", () => {
  const addOns = [
    { id: "addon_1", workspace_id: "ws", service_version_id: "version_1", label: "Preview edit", description: null, price_delta_minor: 20000, display_order: 0, created_at: "", updated_at: "" },
    { id: "addon_2", workspace_id: "ws", service_version_id: "version_1", label: "Extra hour", description: null, price_delta_minor: 15000, display_order: 1, created_at: "", updated_at: "" },
  ];

  it("returns the base price alone when nothing is selected", () => {
    expect(computeServicePrice(100000, addOns, [])).toBe(100000);
  });

  it("adds one selected add-on's price delta", () => {
    expect(computeServicePrice(100000, addOns, ["addon_1"])).toBe(120000);
  });

  it("adds every selected add-on's price delta", () => {
    expect(computeServicePrice(100000, addOns, ["addon_1", "addon_2"])).toBe(135000);
  });

  it("ignores an add-on id that doesn't match any known add-on", () => {
    expect(computeServicePrice(100000, addOns, ["not_a_real_id"])).toBe(100000);
  });

  it("can be called standalone for a price preview with no Event context — e.g. Proposal Builder", () => {
    expect(computeServicePrice(85000, [], [])).toBe(85000);
  });
});

describe("computeServiceRequirements", () => {
  const emptyInput = { inventoryTemplateItems: [], purchaseTemplateItems: [], budgetTemplateLines: [], teamRoleRequirements: [], vendorSuggestions: [] };

  it("returns an empty plan for a Service with no requirement templates", () => {
    const plan = computeServiceRequirements(emptyInput);
    expect(plan.inventoryRequirements).toHaveLength(0);
    expect(plan.purchaseRequirements).toHaveLength(0);
    expect(plan.budgetLines).toHaveLength(0);
    expect(plan.teamRequirements).toHaveLength(0);
    expect(plan.vendorAssignments).toHaveLength(0);
  });

  it("maps each template category straight across, one row in, one row out", () => {
    const plan = computeServiceRequirements({
      inventoryTemplateItems: [{ id: "i1", workspace_id: "ws", service_version_id: "v1", inventory_item_id: null, item_name: "Reflector kit", quantity: 1, display_order: 0, created_at: "", updated_at: "" }],
      purchaseTemplateItems: [{ id: "p1", workspace_id: "ws", service_version_id: "v1", item_name: "Memory cards", estimated_unit_cost_minor: 4000, estimated_quantity: 2, typical_vendor_id: null, display_order: 0, created_at: "", updated_at: "" }],
      budgetTemplateLines: [{ id: "b1", workspace_id: "ws", service_version_id: "v1", label: "Photography package", category: "photography", estimated_revenue_minor: 100000, estimated_cost_minor: 60000, display_order: 0, created_at: "", updated_at: "" }],
      teamRoleRequirements: [{ id: "r1", workspace_id: "ws", service_version_id: "v1", role_label: "Lead Photographer", quantity: 1, note: null, display_order: 0, created_at: "", updated_at: "" }],
      vendorSuggestions: [{ id: "v1", workspace_id: "ws", service_version_id: "v1", vendor_id: "vendor_1", note: null, display_order: 0, created_at: "", updated_at: "" }],
    });
    expect(plan.inventoryRequirements).toEqual([{ inventory_item_id: null, item_name: "Reflector kit", quantity: 1 }]);
    expect(plan.purchaseRequirements).toEqual([{ item_name: "Memory cards", estimated_unit_cost_minor: 4000, estimated_quantity: 2, typical_vendor_id: null }]);
    expect(plan.teamRequirements).toEqual([{ role_label: "Lead Photographer", quantity: 1, note: null }]);
    expect(plan.vendorAssignments).toEqual([{ vendor_id: "vendor_1", note: null }]);
  });
});

describe("buildEventServiceAssignmentPlan", () => {
  const baseInput = {
    service: { id: "service_1", name: "Photography" },
    version: { id: "version_1", name_snapshot: "Photography", base_price_minor: 100000, currency: "USD" },
    addOns: [{ id: "addon_1", workspace_id: "ws", service_version_id: "version_1", label: "Preview edit", description: null, price_delta_minor: 20000, display_order: 0, created_at: "", updated_at: "" }],
    checklistTemplateItems: [
      { id: "c1", workspace_id: "ws", service_version_id: "version_1", title: "Confirm shot list", description: null, category: "photography" as const, priority: "high" as const, due_offset_days: 7, display_order: 0, created_at: "", updated_at: "" },
    ],
    timelineTemplateItems: [
      { id: "t1", workspace_id: "ws", service_version_id: "version_1", title: "Arrival", description: null, category: "arrival" as const, offset_minutes_from_event_start: -60, duration_minutes: 30, display_order: 0, created_at: "", updated_at: "" },
    ],
    inventoryTemplateItems: [{ id: "i1", workspace_id: "ws", service_version_id: "version_1", inventory_item_id: null, item_name: "Reflector kit", quantity: 1, display_order: 0, created_at: "", updated_at: "" }],
    purchaseTemplateItems: [{ id: "p1", workspace_id: "ws", service_version_id: "version_1", item_name: "Memory cards", estimated_unit_cost_minor: 4000, estimated_quantity: 2, typical_vendor_id: null, display_order: 0, created_at: "", updated_at: "" }],
    budgetTemplateLines: [{ id: "b1", workspace_id: "ws", service_version_id: "version_1", label: "Photography package", category: "photography", estimated_revenue_minor: 100000, estimated_cost_minor: 60000, display_order: 0, created_at: "", updated_at: "" }],
    teamRoleRequirements: [{ id: "r1", workspace_id: "ws", service_version_id: "version_1", role_label: "Lead Photographer", quantity: 1, note: null, display_order: 0, created_at: "", updated_at: "" }],
    vendorSuggestions: [{ id: "v1", workspace_id: "ws", service_version_id: "version_1", vendor_id: "vendor_1", note: null, display_order: 0, created_at: "", updated_at: "" }],
  };

  it("resolves the checklist item's due date from the offset against the Event date", () => {
    const plan = buildEventServiceAssignmentPlan(baseInput, { eventDate: "2026-08-15", eventStartTime: "15:00" });
    expect(plan.checklistItems[0].due_date).toBe("2026-08-08");
    expect(plan.checklistItems[0].template_snapshot.due_date).toBe("2026-08-08");
  });

  it("resolves the schedule item's start/end time from the offset against the Event start time", () => {
    const plan = buildEventServiceAssignmentPlan(baseInput, { eventDate: "2026-08-15", eventStartTime: "15:00" });
    expect(plan.scheduleItems[0].start_time).toBe("14:00");
    expect(plan.scheduleItems[0].end_time).toBe("14:30");
  });

  it("charges the base price alone when no add-ons are selected", () => {
    const plan = buildEventServiceAssignmentPlan(baseInput, { eventDate: "2026-08-15", eventStartTime: "15:00" });
    expect(plan.price_minor).toBe(100000);
    expect(plan.price_template_value).toBe(100000);
  });

  it("adds a selected add-on's price delta to the base price", () => {
    const plan = buildEventServiceAssignmentPlan(baseInput, { eventDate: "2026-08-15", eventStartTime: "15:00", selectedAddOnIds: ["addon_1"] });
    expect(plan.price_minor).toBe(120000);
    expect(plan.selected_add_on_ids).toEqual(["addon_1"]);
  });

  it("carries every template category through to its own generated requirement list, one-to-one", () => {
    const plan = buildEventServiceAssignmentPlan(baseInput, { eventDate: "2026-08-15", eventStartTime: "15:00" });
    expect(plan.inventoryRequirements).toHaveLength(1);
    expect(plan.purchaseRequirements).toHaveLength(1);
    expect(plan.budgetLines).toHaveLength(1);
    expect(plan.teamRequirements).toHaveLength(1);
    expect(plan.vendorAssignments).toHaveLength(1);
    expect(plan.inventoryRequirements[0].item_name).toBe("Reflector kit");
  });

  it("is deterministic — identical inputs produce identical output", () => {
    const context = { eventDate: "2026-08-15", eventStartTime: "15:00" };
    expect(buildEventServiceAssignmentPlan(baseInput, context)).toEqual(buildEventServiceAssignmentPlan(baseInput, context));
  });

  it("resolves to null dates/times gracefully when the Event has none set yet", () => {
    const plan = buildEventServiceAssignmentPlan(baseInput, { eventDate: null, eventStartTime: null });
    expect(plan.checklistItems[0].due_date).toBeNull();
    expect(plan.scheduleItems[0].start_time).toBeNull();
    expect(plan.scheduleItems[0].end_time).toBeNull();
  });

  it("orders generated checklist and schedule items by display_order regardless of input array order — matches the assign_service_to_event SQL RPC's `order by display_order`", () => {
    const outOfOrderInput = {
      ...baseInput,
      checklistTemplateItems: [
        { id: "c2", workspace_id: "ws", service_version_id: "version_1", title: "Send final gallery", description: null, category: "photography" as const, priority: "normal" as const, due_offset_days: 1, display_order: 1, created_at: "", updated_at: "" },
        { id: "c1", workspace_id: "ws", service_version_id: "version_1", title: "Confirm shot list", description: null, category: "photography" as const, priority: "high" as const, due_offset_days: 7, display_order: 0, created_at: "", updated_at: "" },
      ],
      timelineTemplateItems: [
        { id: "t2", workspace_id: "ws", service_version_id: "version_1", title: "Departure", description: null, category: "departure" as const, offset_minutes_from_event_start: 60, duration_minutes: 15, display_order: 1, created_at: "", updated_at: "" },
        { id: "t1", workspace_id: "ws", service_version_id: "version_1", title: "Arrival", description: null, category: "arrival" as const, offset_minutes_from_event_start: -60, duration_minutes: 30, display_order: 0, created_at: "", updated_at: "" },
      ],
    };
    const plan = buildEventServiceAssignmentPlan(outOfOrderInput, { eventDate: "2026-08-15", eventStartTime: "15:00" });
    expect(plan.checklistItems.map((item) => item.title)).toEqual(["Confirm shot list", "Send final gallery"]);
    expect(plan.scheduleItems.map((item) => item.title)).toEqual(["Arrival", "Departure"]);
  });
});
