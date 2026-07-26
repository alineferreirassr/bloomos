import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  getEventService: vi.fn(),
  getEventById: vi.fn(),
  getClientById: vi.fn(),
  getServiceVersion: vi.fn(),
  listEventServiceInventoryRequirements: vi.fn(),
  listEventServicePurchaseRequirements: vi.fn(),
  listEventServiceBudgetLines: vi.fn(),
  listEventServiceTeamRequirements: vi.fn(),
  listEventServiceVendorAssignments: vi.fn(),
  listEventServiceQuestionnaireResponses: vi.fn(),
  listServiceQuestionnaireQuestions: vi.fn(),
  getNotesByEventServiceId: vi.fn(),
  getTimelineByEventServiceId: vi.fn(),
}));

import { getEventServiceWorkspace, computeFulfillmentSummary } from "@/lib/queries/services/eventServiceWorkspace";
import {
  getEventService,
  getEventById,
  getClientById,
  getServiceVersion,
  listEventServiceInventoryRequirements,
  listEventServicePurchaseRequirements,
  listEventServiceBudgetLines,
  listEventServiceTeamRequirements,
  listEventServiceVendorAssignments,
  listEventServiceQuestionnaireResponses,
  listServiceQuestionnaireQuestions,
  getNotesByEventServiceId,
  getTimelineByEventServiceId,
} from "@/lib/data";

function eventService(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "es_1",
    workspace_id: "ws",
    event_id: "event_1",
    service_id: "service_1",
    service_version_id: "version_1",
    name: "Photography",
    name_template_value: "Photography",
    price_minor: 100000,
    price_template_value: 100000,
    currency: "USD",
    selected_add_on_ids: [],
    status: "proposed",
    assigned_at: "",
    assigned_by: "",
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getEventById).mockResolvedValue({ id: "event_1", client_id: "client_1" } as never);
  vi.mocked(getClientById).mockResolvedValue({ id: "client_1" } as never);
  vi.mocked(getServiceVersion).mockResolvedValue({ id: "version_1" } as never);
  vi.mocked(listEventServiceBudgetLines).mockResolvedValue([]);
  vi.mocked(listEventServiceQuestionnaireResponses).mockResolvedValue([]);
  vi.mocked(listServiceQuestionnaireQuestions).mockResolvedValue([]);
  vi.mocked(getNotesByEventServiceId).mockResolvedValue([]);
  vi.mocked(getTimelineByEventServiceId).mockResolvedValue([]);
});

describe("getEventServiceWorkspace", () => {
  it("flags override only when the live value diverges from the frozen template value", async () => {
    vi.mocked(getEventService).mockResolvedValue(eventService({ name: "Photography (Extended)" }) as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([]);
    vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([]);

    const workspace = await getEventServiceWorkspace("es_1");
    expect(workspace.isNameOverridden).toBe(true);
    expect(workspace.isPriceOverridden).toBe(false);
  });

  it("computes fulfillment using each requirement type's own resolved condition, excluding budget lines entirely", async () => {
    vi.mocked(getEventService).mockResolvedValue(eventService() as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([{ id: "i1", is_fulfilled: true }, { id: "i2", is_fulfilled: false }] as never);
    vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([{ id: "p1", fulfilled_purchase_id: "purchase_1" }] as never);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([{ id: "t1", assigned_member_id: null }] as never);
    vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([{ id: "v1", status: "confirmed" }, { id: "v2", status: "suggested" }] as never);
    vi.mocked(listEventServiceBudgetLines).mockResolvedValue([{ id: "b1" }, { id: "b2" }] as never);

    const workspace = await getEventServiceWorkspace("es_1");
    // resolved: i1 (fulfilled) + p1 (linked) + v1 (confirmed) = 3; i2/t1/v2 unresolved.
    expect(workspace.fulfillmentSummary.resolved).toBe(3);
    // total counts inventory+purchase+team+vendor only (2+1+1+2=6), never budget lines.
    expect(workspace.fulfillmentSummary.total).toBe(6);
  });

  it("treats a declined vendor assignment as resolved, not pending", async () => {
    vi.mocked(getEventService).mockResolvedValue(eventService() as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([]);
    vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([{ id: "v1", status: "declined" }] as never);

    const workspace = await getEventServiceWorkspace("es_1");
    expect(workspace.fulfillmentSummary.resolved).toBe(1);
    expect(workspace.fulfillmentSummary.total).toBe(1);
  });

  it("merges each question with its response by question_id, using null for an unanswered question rather than omitting it", async () => {
    vi.mocked(getEventService).mockResolvedValue(eventService() as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([]);
    vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([]);
    vi.mocked(listServiceQuestionnaireQuestions).mockResolvedValue([{ id: "q1" }, { id: "q2" }] as never);
    vi.mocked(listEventServiceQuestionnaireResponses).mockResolvedValue([{ id: "r1", question_id: "q1", response_text: "Yes" }] as never);

    const workspace = await getEventServiceWorkspace("es_1");
    expect(workspace.questionnaire).toHaveLength(2);
    expect(workspace.questionnaire.find((q) => q.question.id === "q1")?.response?.response_text).toBe("Yes");
    expect(workspace.questionnaire.find((q) => q.question.id === "q2")?.response).toBeNull();
  });

  it("resolves questions against the pinned service_version_id, never the catalog Service's current draft/published version", async () => {
    vi.mocked(getEventService).mockResolvedValue(eventService({ service_version_id: "pinned_version_7" }) as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([]);
    vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([]);

    await getEventServiceWorkspace("es_1");
    expect(listServiceQuestionnaireQuestions).toHaveBeenCalledWith("pinned_version_7");
  });

  it("joins the owning Event and Client, resolving the Client through the Event's own client_id", async () => {
    vi.mocked(getEventService).mockResolvedValue(eventService({ event_id: "event_9" }) as never);
    vi.mocked(getEventById).mockResolvedValue({ id: "event_9", client_id: "client_9" } as never);
    vi.mocked(getClientById).mockResolvedValue({ id: "client_9", first_name: "Amelia" } as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([]);
    vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([]);
    vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([]);

    const workspace = await getEventServiceWorkspace("es_1");
    expect(getEventById).toHaveBeenCalledWith("event_9");
    expect(getClientById).toHaveBeenCalledWith("client_9");
    expect(workspace.event.id).toBe("event_9");
    expect(workspace.client.first_name).toBe("Amelia");
  });
});

describe("computeFulfillmentSummary", () => {
  it("is the exact function getEventServiceWorkspace's own fulfillmentSummary delegates to — callable directly for a list of rows that never fetched budget/questionnaire/notes/timeline", () => {
    const summary = computeFulfillmentSummary({
      inventory: [{ id: "i1", is_fulfilled: true }, { id: "i2", is_fulfilled: false }] as never,
      purchase: [{ id: "p1", fulfilled_purchase_id: "purchase_1" }] as never,
      team: [{ id: "t1", assigned_member_id: null }] as never,
      vendor: [{ id: "v1", status: "confirmed" }, { id: "v2", status: "suggested" }] as never,
    });
    expect(summary).toEqual({ resolved: 3, total: 6 });
  });
});
