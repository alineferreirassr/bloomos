import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/data", () => ({
  getServiceVersion: vi.fn(),
  listServiceIncludedItems: vi.fn(),
  listServiceAddOns: vi.fn(),
  listServiceChecklistTemplateItems: vi.fn(),
  listServiceTimelineTemplateItems: vi.fn(),
  listServiceTravelTemplateItems: vi.fn(),
  listServiceQuestionnaireQuestions: vi.fn(),
  listServiceRequiredDocuments: vi.fn(),
  listServiceApprovalTemplateItems: vi.fn(),
  listServiceInventoryTemplateItems: vi.fn(),
  listServicePurchaseTemplateItems: vi.fn(),
  listServiceVendorSuggestions: vi.fn(),
  listServiceTeamRoleRequirements: vi.fn(),
  listServiceCapabilityRequirements: vi.fn(),
  listServiceBudgetTemplateLines: vi.fn(),
  listServiceSeasonalWindows: vi.fn(),
  listServiceAiKnowledgeItems: vi.fn(),
}));

import { getTemplateBuilder } from "@/lib/queries/services/templateBuilder";
import * as dataLayer from "@/lib/data";
import { TEMPLATE_CATEGORY_KEYS } from "@/lib/queries/services/types";

function mockEveryListEmpty() {
  for (const fn of Object.values(dataLayer)) {
    if (typeof fn === "function" && "mockResolvedValue" in fn) {
      (fn as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTemplateBuilder", () => {
  it("groups all 16 categories into exactly the 6 approved groups, with every category key appearing exactly once", async () => {
    vi.mocked(dataLayer.getServiceVersion).mockResolvedValue({ id: "version_1", status: "draft" } as never);
    mockEveryListEmpty();

    const builder = await getTemplateBuilder("version_1");
    expect(builder.groups).toHaveLength(6);

    const allCategoryKeys = builder.groups.flatMap((group) => group.categories.map((c) => c.key));
    expect(allCategoryKeys).toHaveLength(TEMPLATE_CATEGORY_KEYS.length);
    expect(new Set(allCategoryKeys).size).toBe(TEMPLATE_CATEGORY_KEYS.length);
    for (const key of TEMPLATE_CATEGORY_KEYS) {
      expect(allCategoryKeys).toContain(key);
    }
  });

  it("marks isEditable true only while the version is a draft", async () => {
    vi.mocked(dataLayer.getServiceVersion).mockResolvedValue({ id: "version_1", status: "published" } as never);
    mockEveryListEmpty();

    const builder = await getTemplateBuilder("version_1");
    expect(builder.isEditable).toBe(false);
  });

  it("marks exactly the 5 health-weighted categories as 'expected', everything else 'optional'", async () => {
    vi.mocked(dataLayer.getServiceVersion).mockResolvedValue({ id: "version_1", status: "draft" } as never);
    mockEveryListEmpty();

    const builder = await getTemplateBuilder("version_1");
    const expectedKeys = builder.groups.flatMap((g) => g.categories).filter((c) => c.expectation === "expected").map((c) => c.key);
    expect(new Set(expectedKeys)).toEqual(new Set(["checklistItems", "timelineItems", "teamRoleRequirements", "budgetLines", "questionnaireQuestions"]));
  });

  it("reports an accurate row count per category from the underlying list call", async () => {
    vi.mocked(dataLayer.getServiceVersion).mockResolvedValue({ id: "version_1", status: "draft" } as never);
    mockEveryListEmpty();
    vi.mocked(dataLayer.listServiceChecklistTemplateItems).mockResolvedValue([{}, {}, {}] as never);

    const builder = await getTemplateBuilder("version_1");
    const checklist = builder.groups.flatMap((g) => g.categories).find((c) => c.key === "checklistItems");
    expect(checklist?.count).toBe(3);
    expect(checklist?.rows).toHaveLength(3);
  });
});
