import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  fulfillEventServiceInventoryRequirement: vi.fn(),
  linkEventServicePurchaseRequirementToPurchase: vi.fn(),
  confirmEventServiceVendorAssignment: vi.fn(),
  declineEventServiceVendorAssignment: vi.fn(),
  submitEventServiceQuestionnaireResponse: vi.fn(),
}));

import { useFulfillEventServiceInventoryRequirement, useSubmitEventServiceQuestionnaireResponse } from "@/modules/services/hooks/useEventServiceRequirementMutations";
import { fulfillEventServiceInventoryRequirement, submitEventServiceQuestionnaireResponse } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";
import type { EventServiceWorkspaceData } from "@/lib/queries/services/types";

function seedWorkspace(overrides: Partial<EventServiceWorkspaceData> = {}): EventServiceWorkspaceData {
  return {
    eventService: { id: "es_1" } as never,
    event: { id: "event_1" } as never,
    client: { id: "client_1" } as never,
    version: { id: "version_1" } as never,
    isNameOverridden: false,
    isPriceOverridden: false,
    requirements: {
      inventory: [{ id: "req_1", is_fulfilled: false } as never],
      purchase: [],
      budget: [],
      team: [],
      vendor: [],
    },
    fulfillmentSummary: { resolved: 0, total: 1 },
    questionnaire: [],
    notes: [],
    timeline: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useFulfillEventServiceInventoryRequirement", () => {
  it("optimistically flips is_fulfilled and recomputes the fulfillment summary before the repository call resolves", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(serviceKeys.eventServiceWorkspace("es_1"), seedWorkspace());

    let resolveMutation!: (value: unknown) => void;
    vi.mocked(fulfillEventServiceInventoryRequirement).mockReturnValue(new Promise((resolve) => (resolveMutation = resolve)) as never);

    const { result } = renderHook(() => useFulfillEventServiceInventoryRequirement("es_1"), { wrapper: createWrapper(queryClient) });

    act(() => {
      result.current.mutate("req_1");
    });

    await waitFor(() => {
      const optimistic = queryClient.getQueryData<EventServiceWorkspaceData>(serviceKeys.eventServiceWorkspace("es_1"));
      expect(optimistic?.requirements.inventory[0].is_fulfilled).toBe(true);
      expect(optimistic?.fulfillmentSummary.resolved).toBe(1);
    });

    resolveMutation({ success: true, data: {} });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("rolls back to the pre-mutation snapshot when the repository call fails", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(serviceKeys.eventServiceWorkspace("es_1"), seedWorkspace());

    let rejectMutation!: (reason: unknown) => void;
    vi.mocked(fulfillEventServiceInventoryRequirement).mockReturnValue(new Promise((_resolve, reject) => (rejectMutation = reject)) as never);

    const { result } = renderHook(() => useFulfillEventServiceInventoryRequirement("es_1"), { wrapper: createWrapper(queryClient) });

    act(() => {
      result.current.mutate("req_1");
    });

    await waitFor(() => {
      const optimistic = queryClient.getQueryData<EventServiceWorkspaceData>(serviceKeys.eventServiceWorkspace("es_1"));
      expect(optimistic?.requirements.inventory[0].is_fulfilled).toBe(true);
    });

    rejectMutation(new Error("network blip"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    const rolledBack = queryClient.getQueryData<EventServiceWorkspaceData>(serviceKeys.eventServiceWorkspace("es_1"));
    expect(rolledBack?.requirements.inventory[0].is_fulfilled).toBe(false);
    expect(rolledBack?.fulfillmentSummary.resolved).toBe(0);
  });
});

describe("useSubmitEventServiceQuestionnaireResponse", () => {
  it("is immediate-autosave but NOT optimistic — the cache only updates after the real response resolves", async () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(serviceKeys.eventServiceWorkspace("es_1"), seedWorkspace());
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(submitEventServiceQuestionnaireResponse).mockResolvedValue({ success: true, data: { id: "resp_1" } } as never);

    const { result } = renderHook(() => useSubmitEventServiceQuestionnaireResponse("es_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ question_id: "q1", response_text: "Yes", response_options: null, response_boolean: null, response_date: null });
    });

    // No onMutate/setQueryData ever ran — the only cache effect is the post-success invalidation.
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: serviceKeys.eventServiceWorkspace("es_1") });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
  });
});
