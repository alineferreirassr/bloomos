import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  getService: vi.fn(),
  listEventServicesByService: vi.fn(),
  listServiceVersions: vi.fn(),
  getEventById: vi.fn(),
  getClientById: vi.fn(),
  listEventServiceInventoryRequirements: vi.fn(),
  listEventServicePurchaseRequirements: vi.fn(),
  listEventServiceTeamRequirements: vi.fn(),
  listEventServiceVendorAssignments: vi.fn(),
}));

import { getServiceAssignments } from "@/lib/queries/services/assignments";
import {
  getService,
  listEventServicesByService,
  listServiceVersions,
  getEventById,
  getClientById,
  listEventServiceInventoryRequirements,
  listEventServicePurchaseRequirements,
  listEventServiceTeamRequirements,
  listEventServiceVendorAssignments,
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
    status: "confirmed",
    assigned_at: "2026-01-01T00:00:00.000Z",
    assigned_by: "Owner",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getService).mockResolvedValue({ id: "service_1" } as never);
  vi.mocked(listServiceVersions).mockResolvedValue([{ id: "version_1", version_number: 3 }] as never);
  vi.mocked(getEventById).mockResolvedValue({ id: "event_1", client_id: "client_1", title: "Wedding" } as never);
  vi.mocked(getClientById).mockResolvedValue({ id: "client_1", first_name: "Amelia", last_name: "Carter" } as never);
  vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([]);
  vi.mocked(listEventServicePurchaseRequirements).mockResolvedValue([]);
  vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([]);
  vi.mocked(listEventServiceVendorAssignments).mockResolvedValue([]);
});

describe("getServiceAssignments", () => {
  it("returns an empty rows array when the Service has no assignments, without fetching Event/Client data", async () => {
    vi.mocked(listEventServicesByService).mockResolvedValue([]);
    const result = await getServiceAssignments("service_1");
    expect(result.rows).toEqual([]);
    expect(getEventById).not.toHaveBeenCalled();
  });

  it("joins each EventService with its Event and Client, and resolves the version number from the pinned service_version_id", async () => {
    vi.mocked(listEventServicesByService).mockResolvedValue([eventService()] as never);
    const result = await getServiceAssignments("service_1");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].event.title).toBe("Wedding");
    expect(result.rows[0].client.first_name).toBe("Amelia");
    expect(result.rows[0].versionNumber).toBe(3);
  });

  it("reports versionNumber as null when the pinned service_version_id isn't in the Service's current version list", async () => {
    vi.mocked(listEventServicesByService).mockResolvedValue([eventService({ service_version_id: "deleted_version" })] as never);
    const result = await getServiceAssignments("service_1");
    expect(result.rows[0].versionNumber).toBeNull();
  });

  it("flags override state from plain field comparison, no extra fetch involved", async () => {
    vi.mocked(listEventServicesByService).mockResolvedValue([eventService({ name: "Photography (Extended)" })] as never);
    const result = await getServiceAssignments("service_1");
    expect(result.rows[0].isNameOverridden).toBe(true);
    expect(result.rows[0].isPriceOverridden).toBe(false);
  });

  it("computes team counts and completion using the same resolved-condition rules as getEventServiceWorkspace, via the shared computeFulfillmentSummary", async () => {
    vi.mocked(listEventServicesByService).mockResolvedValue([eventService()] as never);
    vi.mocked(listEventServiceTeamRequirements).mockResolvedValue([
      { id: "t1", assigned_member_id: "member_1" },
      { id: "t2", assigned_member_id: null },
    ] as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([{ id: "i1", is_fulfilled: true }] as never);

    const result = await getServiceAssignments("service_1");
    expect(result.rows[0].team).toEqual({ resolved: 1, total: 2 });
    expect(result.rows[0].completion).toEqual({ resolved: 2, total: 3 });
  });

  it("never fetches questionnaire/notes/timeline data — that stays reserved for the lazy per-assignment workspace fetch", async () => {
    vi.mocked(listEventServicesByService).mockResolvedValue([eventService()] as never);
    await getServiceAssignments("service_1");
    // Only the four requirement lists + Event/Client are ever called per row.
    expect(listEventServiceInventoryRequirements).toHaveBeenCalledTimes(1);
    expect(listEventServicePurchaseRequirements).toHaveBeenCalledTimes(1);
    expect(listEventServiceTeamRequirements).toHaveBeenCalledTimes(1);
    expect(listEventServiceVendorAssignments).toHaveBeenCalledTimes(1);
  });
});
