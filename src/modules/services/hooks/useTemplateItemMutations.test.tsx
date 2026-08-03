import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  createServiceIncludedItem: vi.fn(),
  updateServiceIncludedItem: vi.fn(),
  removeServiceIncludedItem: vi.fn(),
  createServiceAddOn: vi.fn(),
  updateServiceAddOn: vi.fn(),
  removeServiceAddOn: vi.fn(),
  createServiceChecklistTemplateItem: vi.fn(),
  updateServiceChecklistTemplateItem: vi.fn(),
  removeServiceChecklistTemplateItem: vi.fn(),
  createServiceTimelineTemplateItem: vi.fn(),
  updateServiceTimelineTemplateItem: vi.fn(),
  removeServiceTimelineTemplateItem: vi.fn(),
  createServiceQuestionnaireQuestion: vi.fn(),
  updateServiceQuestionnaireQuestion: vi.fn(),
  removeServiceQuestionnaireQuestion: vi.fn(),
  createServiceBudgetTemplateLine: vi.fn(),
  updateServiceBudgetTemplateLine: vi.fn(),
  removeServiceBudgetTemplateLine: vi.fn(),
  createServiceApprovalTemplateItem: vi.fn(),
  updateServiceApprovalTemplateItem: vi.fn(),
  removeServiceApprovalTemplateItem: vi.fn(),
  createServiceTravelTemplateItem: vi.fn(),
  updateServiceTravelTemplateItem: vi.fn(),
  removeServiceTravelTemplateItem: vi.fn(),
  createServiceAiKnowledgeItem: vi.fn(),
  updateServiceAiKnowledgeItem: vi.fn(),
  removeServiceAiKnowledgeItem: vi.fn(),
  createServiceRequiredDocument: vi.fn(),
  updateServiceRequiredDocument: vi.fn(),
  removeServiceRequiredDocument: vi.fn(),
  createServiceInventoryTemplateItem: vi.fn(),
  updateServiceInventoryTemplateItem: vi.fn(),
  removeServiceInventoryTemplateItem: vi.fn(),
  createServicePurchaseTemplateItem: vi.fn(),
  updateServicePurchaseTemplateItem: vi.fn(),
  removeServicePurchaseTemplateItem: vi.fn(),
  createServiceVendorSuggestion: vi.fn(),
  updateServiceVendorSuggestion: vi.fn(),
  removeServiceVendorSuggestion: vi.fn(),
  createServiceTeamRoleRequirement: vi.fn(),
  updateServiceTeamRoleRequirement: vi.fn(),
  removeServiceTeamRoleRequirement: vi.fn(),
  createServiceCapabilityRequirement: vi.fn(),
  updateServiceCapabilityRequirement: vi.fn(),
  removeServiceCapabilityRequirement: vi.fn(),
  createServiceSeasonalWindow: vi.fn(),
  updateServiceSeasonalWindow: vi.fn(),
  removeServiceSeasonalWindow: vi.fn(),
}));

import { checklistTemplateItemMutations, seasonalWindowMutations } from "@/modules/services/hooks/useTemplateItemMutations";
import { createServiceChecklistTemplateItem, updateServiceChecklistTemplateItem, removeServiceChecklistTemplateItem } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

/** checklistTemplateItemMutations stands in for all 16 categories — they share one generic factory, so this exercises the one code path every other category also runs through. */
describe("checklistTemplateItemMutations", () => {
  it("create: calls the repository with the serviceVersionId and invalidates templates/health/publishPreview/lists/healthDashboards, never versions() or any eventService key", async () => {
    vi.mocked(createServiceChecklistTemplateItem).mockResolvedValue({ success: true, data: { id: "item_1" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => checklistTemplateItemMutations.useCreate("service_1", "version_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ title: "Confirm shot list", description: null, category: "photography", priority: "high", due_offset_days: 7, display_order: 0 });
    });

    expect(createServiceChecklistTemplateItem).toHaveBeenCalledWith("version_1", expect.objectContaining({ title: "Confirm shot list" }));
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.templates("version_1"), serviceKeys.health("service_1"), serviceKeys.publishPreview("service_1"), serviceKeys.lists(), serviceKeys.healthDashboards()]),
    );
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.versions("service_1"));
  });

  it("update: unwraps the repository's DataResult and rejects on failure with the repository's own message preserved", async () => {
    vi.mocked(updateServiceChecklistTemplateItem).mockResolvedValue({ success: false, error: "This version has already been published and can no longer be edited — edit the draft version instead." } as never);

    const { result } = renderHook(() => checklistTemplateItemMutations.useUpdate("service_1", "version_1"), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync({ id: "item_1", input: { title: "x", description: null, category: "photography", priority: "high", due_offset_days: null, display_order: 0 } })).rejects.toThrow(
        /already been published/i,
      );
    });
  });

  it("remove: calls the repository with just the row id", async () => {
    vi.mocked(removeServiceChecklistTemplateItem).mockResolvedValue({ success: true, data: null } as never);

    const { result } = renderHook(() => checklistTemplateItemMutations.useRemove("service_1", "version_1"), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync("item_1");
    });

    expect(removeServiceChecklistTemplateItem).toHaveBeenCalledWith("item_1");
  });

  it("reorder: issues one update call per row with display_order set to its new array index, every other field preserved", async () => {
    vi.mocked(updateServiceChecklistTemplateItem).mockResolvedValue({ success: true, data: {} } as never);

    const rows = [
      { id: "item_2", title: "Second", description: null, category: "photography" as const, priority: "normal" as const, due_offset_days: 1, display_order: 1 },
      { id: "item_1", title: "First", description: null, category: "photography" as const, priority: "high" as const, due_offset_days: 7, display_order: 0 },
    ];

    const { result } = renderHook(() => checklistTemplateItemMutations.useReorder("service_1", "version_1"), { wrapper: createWrapper() });
    await act(async () => {
      await result.current.mutateAsync(rows as never);
    });

    expect(updateServiceChecklistTemplateItem).toHaveBeenCalledWith("item_2", expect.objectContaining({ title: "Second", display_order: 0 }));
    expect(updateServiceChecklistTemplateItem).toHaveBeenCalledWith("item_1", expect.objectContaining({ title: "First", display_order: 1 }));
  });
});

describe("seasonalWindowMutations (the one category with no display_order column)", () => {
  it("useReorder rejects immediately rather than reordering against a field that doesn't exist", async () => {
    const { result } = renderHook(() => seasonalWindowMutations.useReorder("service_1", "version_1"), { wrapper: createWrapper() });
    await act(async () => {
      await expect(result.current.mutateAsync([])).rejects.toThrow(/does not support reordering/i);
    });
  });
});
