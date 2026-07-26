import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  getService: vi.fn(),
  getServiceVersion: vi.fn(),
  listServices: vi.fn(),
  listEventServicesByEvent: vi.fn(),
  listServiceAddOns: vi.fn(),
  listServiceChecklistTemplateItems: vi.fn(),
  listServiceTimelineTemplateItems: vi.fn(),
  listServiceInventoryTemplateItems: vi.fn(),
  listServicePurchaseTemplateItems: vi.fn(),
  listServiceBudgetTemplateLines: vi.fn(),
  listServiceTeamRoleRequirements: vi.fn(),
  listServiceVendorSuggestions: vi.fn(),
}));
vi.mock("@/lib/queries/services/health", () => ({
  getServiceHealth: vi.fn(),
}));

import { getAssignmentWorkspace, getAssignmentPreview } from "@/lib/queries/services/assignment";
import {
  getService,
  getServiceVersion,
  listServices,
  listEventServicesByEvent,
  listServiceAddOns,
  listServiceChecklistTemplateItems,
  listServiceTimelineTemplateItems,
  listServiceInventoryTemplateItems,
  listServicePurchaseTemplateItems,
  listServiceBudgetTemplateLines,
  listServiceTeamRoleRequirements,
  listServiceVendorSuggestions,
} from "@/lib/data";
import { getServiceHealth } from "@/lib/queries/services/health";

function service(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "service_1", workspace_id: "ws", category_id: null, name: "Photography", description: null, status: "active", draft_version_id: "draft_1", current_published_version_id: "published_1", created_at: "", updated_at: "", archived_at: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listServiceChecklistTemplateItems).mockResolvedValue([]);
  vi.mocked(listServiceTimelineTemplateItems).mockResolvedValue([]);
  vi.mocked(listServiceInventoryTemplateItems).mockResolvedValue([]);
  vi.mocked(listServicePurchaseTemplateItems).mockResolvedValue([]);
  vi.mocked(listServiceBudgetTemplateLines).mockResolvedValue([]);
  vi.mocked(listServiceTeamRoleRequirements).mockResolvedValue([]);
  vi.mocked(listServiceVendorSuggestions).mockResolvedValue([]);
  vi.mocked(listServiceAddOns).mockResolvedValue([]);
});

describe("getAssignmentWorkspace", () => {
  it("excludes an active Service with no published version — canAssignService's own rule, never re-derived", async () => {
    vi.mocked(listServices).mockResolvedValue([service({ current_published_version_id: null }), service({ id: "service_2" })] as never);
    vi.mocked(listEventServicesByEvent).mockResolvedValue([]);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "published_1" } as never);
    vi.mocked(getServiceHealth).mockResolvedValue({ percent: 100, missing: [] });

    const workspace = await getAssignmentWorkspace("event_1");
    expect(workspace.eligibleServices).toHaveLength(1);
    expect(workspace.eligibleServices[0].service.id).toBe("service_2");
  });

  it("passes the active-status filter through to listServices, not a client-side re-filter of everything", async () => {
    vi.mocked(listServices).mockResolvedValue([]);
    vi.mocked(listEventServicesByEvent).mockResolvedValue([]);

    await getAssignmentWorkspace("event_1");
    expect(listServices).toHaveBeenCalledWith({ status: "active" });
  });
});

describe("getAssignmentPreview", () => {
  it("computes price via the shared computeServicePrice pure function — base price plus only the selected add-ons", async () => {
    vi.mocked(getService).mockResolvedValue(service() as never);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "published_1", base_price_minor: 100000, currency: "USD" } as never);
    vi.mocked(listServiceAddOns).mockResolvedValue([
      { id: "addon_1", price_delta_minor: 5000 },
      { id: "addon_2", price_delta_minor: 20000 },
    ] as never);

    const preview = await getAssignmentPreview("service_1", ["addon_1"]);
    expect(preview.computedPriceMinor).toBe(105000);
  });

  it("reports generated-row counts per category without generating or persisting anything", async () => {
    vi.mocked(getService).mockResolvedValue(service() as never);
    vi.mocked(getServiceVersion).mockResolvedValue({ id: "published_1", base_price_minor: 100000, currency: "USD" } as never);
    vi.mocked(listServiceChecklistTemplateItems).mockResolvedValue([{}, {}] as never);
    vi.mocked(listServiceTeamRoleRequirements).mockResolvedValue([{}] as never);

    const preview = await getAssignmentPreview("service_1", []);
    expect(preview.generatedCounts.checklistItems).toBe(2);
    expect(preview.generatedCounts.teamRequirements).toBe(1);
    expect(preview.generatedCounts.scheduleItems).toBe(0);
  });

  it("throws rather than silently previewing an unassignable Service", async () => {
    vi.mocked(getService).mockResolvedValue(service({ current_published_version_id: null }) as never);

    await expect(getAssignmentPreview("service_1", [])).rejects.toThrow(/no published version/i);
  });
});
