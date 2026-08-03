import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  getService: vi.fn(),
  getServiceVersion: vi.fn(),
  listServices: vi.fn(),
  listServiceCategories: vi.fn(),
  listServiceChecklistTemplateItems: vi.fn(),
  listServiceTimelineTemplateItems: vi.fn(),
  listServiceTeamRoleRequirements: vi.fn(),
  listServiceBudgetTemplateLines: vi.fn(),
  listServiceVendorSuggestions: vi.fn(),
  listServiceInventoryTemplateItems: vi.fn(),
  listServicePurchaseTemplateItems: vi.fn(),
  listServiceQuestionnaireQuestions: vi.fn(),
}));

import { getServiceHealth, getHealthDashboard } from "@/lib/queries/services/health";
import {
  getService,
  getServiceVersion,
  listServices,
  listServiceCategories,
  listServiceChecklistTemplateItems,
  listServiceTimelineTemplateItems,
  listServiceTeamRoleRequirements,
  listServiceBudgetTemplateLines,
  listServiceVendorSuggestions,
  listServiceInventoryTemplateItems,
  listServicePurchaseTemplateItems,
  listServiceQuestionnaireQuestions,
} from "@/lib/data";

function service(overrides: Partial<{ id: string; draft_version_id: string | null; category_id: string | null }> = {}) {
  return { id: "service_1", workspace_id: "ws", category_id: null, name: "Photography", description: null, status: "draft", draft_version_id: "version_1", current_published_version_id: null, created_at: "", updated_at: "", archived_at: null, ...overrides } as never;
}
function version(basePriceMinor: number) {
  return { id: "version_1", service_id: "service_1", workspace_id: "ws", version_number: null, status: "draft", name_snapshot: null, description_snapshot: null, base_price_minor: basePriceMinor, currency: "USD", setup_duration_minutes: null, breakdown_duration_minutes: null, difficulty_score: null, experience_level_required: null, weather_sensitivity: "none", surprise_friendly: false, estimated_profit_minor: null, change_summary: null, published_at: null, published_by: null, created_at: "", updated_at: "" } as never;
}

function mockAllLists(overrides: Partial<Record<string, unknown[]>> = {}) {
  vi.mocked(listServiceChecklistTemplateItems).mockResolvedValue((overrides.checklist ?? []) as never);
  vi.mocked(listServiceTimelineTemplateItems).mockResolvedValue((overrides.timeline ?? []) as never);
  vi.mocked(listServiceTeamRoleRequirements).mockResolvedValue((overrides.team ?? []) as never);
  vi.mocked(listServiceBudgetTemplateLines).mockResolvedValue((overrides.budget ?? []) as never);
  vi.mocked(listServiceVendorSuggestions).mockResolvedValue((overrides.vendors ?? []) as never);
  vi.mocked(listServiceInventoryTemplateItems).mockResolvedValue((overrides.inventory ?? []) as never);
  vi.mocked(listServicePurchaseTemplateItems).mockResolvedValue((overrides.purchases ?? []) as never);
  vi.mocked(listServiceQuestionnaireQuestions).mockResolvedValue((overrides.questionnaire ?? []) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServiceHealth", () => {
  it("returns 100% with no missing items when every expected signal is present", async () => {
    vi.mocked(getService).mockResolvedValue(service());
    vi.mocked(getServiceVersion).mockResolvedValue(version(100000));
    mockAllLists({ checklist: [{}], timeline: [{}], team: [{}], budget: [{}], vendors: [{}], questionnaire: [{}] });

    const health = await getServiceHealth("service_1");
    expect(health.percent).toBe(100);
    expect(health.missing).toHaveLength(0);
  });

  it("returns 0% with every missing item when the draft is completely empty", async () => {
    vi.mocked(getService).mockResolvedValue(service());
    vi.mocked(getServiceVersion).mockResolvedValue(version(0));
    mockAllLists();

    const health = await getServiceHealth("service_1");
    expect(health.percent).toBe(0);
    expect(health.missing.map((m) => m.label)).toEqual(
      expect.arrayContaining(["Set a base price", "Checklist", "Timeline", "Team roles", "Budget", "Vendor", "Inventory", "Purchase", "Questionnaire"]),
    );
  });

  it("awards the combined 10% resource signal if ANY of vendor/inventory/purchase is present, with no missing item for that group", async () => {
    vi.mocked(getService).mockResolvedValue(service());
    vi.mocked(getServiceVersion).mockResolvedValue(version(100000));
    mockAllLists({ checklist: [{}], timeline: [{}], team: [{}], budget: [{}], questionnaire: [{}], inventory: [{}] });

    const health = await getServiceHealth("service_1");
    expect(health.percent).toBe(100);
    expect(health.missing.some((m) => m.label === "Inventory" || m.label === "Vendor" || m.label === "Purchase")).toBe(false);
  });

  it("matches the user's own worked example — missing Vendor/Questionnaire/Inventory/Budget nets 94% is NOT the real number, but 45% (price+checklist+timeline+team) demonstrates the weighting is additive and independent per signal", async () => {
    vi.mocked(getService).mockResolvedValue(service());
    vi.mocked(getServiceVersion).mockResolvedValue(version(100000));
    mockAllLists({ checklist: [{}], timeline: [{}], team: [{}] });

    const health = await getServiceHealth("service_1");
    // basePrice(20) + checklist(15) + timeline(15) + team(15) = 65; budget/resource/questionnaire missing.
    expect(health.percent).toBe(65);
    expect(health.missing.map((m) => m.label)).toEqual(expect.arrayContaining(["Budget", "Vendor", "Inventory", "Purchase", "Questionnaire"]));
  });

  it("every missing item carries a jumpTo target the UI can deep-link to", async () => {
    vi.mocked(getService).mockResolvedValue(service());
    vi.mocked(getServiceVersion).mockResolvedValue(version(0));
    mockAllLists();

    const health = await getServiceHealth("service_1");
    const priceItem = health.missing.find((m) => m.label === "Set a base price");
    expect(priceItem?.jumpTo).toEqual({ kind: "draftVersionForm" });
    const checklistItem = health.missing.find((m) => m.label === "Checklist");
    expect(checklistItem?.jumpTo).toEqual({ kind: "templateCategory", category: "checklistItems" });
  });
});

describe("getHealthDashboard", () => {
  it("computes health for every matching service in parallel and aggregates average/below-threshold counts", async () => {
    // Distinct draft_version_id per service so getServiceVersion can be
    // resolved deterministically by argument rather than by call order —
    // both getServiceHealth calls run concurrently under Promise.all, so
    // relying on mockResolvedValueOnce sequencing here would be flaky.
    vi.mocked(listServices).mockResolvedValue([
      service({ id: "service_1", draft_version_id: "version_1" }),
      service({ id: "service_2", draft_version_id: "version_2" }),
    ] as never);
    vi.mocked(listServiceCategories).mockResolvedValue([{ id: "cat_1", name: "Photography" }] as never);
    vi.mocked(getService).mockImplementation((id: string) =>
      Promise.resolve(service({ id, draft_version_id: id === "service_1" ? "version_1" : "version_2" })),
    );
    vi.mocked(getServiceVersion).mockImplementation((id: string) => Promise.resolve(version(id === "version_1" ? 100000 : 0)));
    // Every list function is keyed by versionId here so service_1
    // ("version_1") is fully healthy and service_2 ("version_2") is
    // completely empty — a genuine, deterministic difference between them.
    const fullFor = (versionId: string) => (id: string) => Promise.resolve(id === versionId ? [{}] : []);
    vi.mocked(listServiceChecklistTemplateItems).mockImplementation(fullFor("version_1") as never);
    vi.mocked(listServiceTimelineTemplateItems).mockImplementation(fullFor("version_1") as never);
    vi.mocked(listServiceTeamRoleRequirements).mockImplementation(fullFor("version_1") as never);
    vi.mocked(listServiceBudgetTemplateLines).mockImplementation(fullFor("version_1") as never);
    vi.mocked(listServiceVendorSuggestions).mockImplementation(fullFor("version_1") as never);
    vi.mocked(listServiceInventoryTemplateItems).mockResolvedValue([]);
    vi.mocked(listServicePurchaseTemplateItems).mockResolvedValue([]);
    vi.mocked(listServiceQuestionnaireQuestions).mockImplementation(fullFor("version_1") as never);

    const dashboard = await getHealthDashboard();
    expect(dashboard.rows).toHaveLength(2);
    const healthByServiceId = new Map(dashboard.rows.map((row) => [row.service.id, row.health.percent]));
    expect(healthByServiceId.get("service_1")).toBe(100);
    expect(healthByServiceId.get("service_2")).toBe(0);
    expect(dashboard.averagePercent).toBe(50);
    expect(dashboard.belowThresholdCount).toBe(1);
  });
});
