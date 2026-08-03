import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  updateChecklistItemStatus: vi.fn(),
}));

import { useUpdateChecklistItemStatus } from "@/modules/services/hooks/useUpdateChecklistItemStatus";
import { updateChecklistItemStatus } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUpdateChecklistItemStatus", () => {
  it("calls updateChecklistItemStatus with the item id and new status", async () => {
    vi.mocked(updateChecklistItemStatus).mockResolvedValue({ success: true, data: { id: "item_1", status: "completed" } } as never);
    const queryClient = createTestQueryClient();
    const { result } = renderHook(() => useUpdateChecklistItemStatus("es_1"), { wrapper: createWrapper(queryClient) });

    act(() => {
      result.current.mutate({ id: "item_1", status: "completed" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(updateChecklistItemStatus).toHaveBeenCalledWith("item_1", "completed");
  });

  it("invalidates only this EventService's checklist cache on success, not the whole workspace", async () => {
    vi.mocked(updateChecklistItemStatus).mockResolvedValue({ success: true, data: { id: "item_1", status: "blocked" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateChecklistItemStatus("es_1"), { wrapper: createWrapper(queryClient) });

    act(() => {
      result.current.mutate({ id: "item_1", status: "blocked" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: serviceKeys.eventServiceChecklist("es_1") });
  });

  it("surfaces a repository failure as the mutation's error state", async () => {
    vi.mocked(updateChecklistItemStatus).mockResolvedValue({ success: false, error: "Cannot update a cancelled item." } as never);
    const { result } = renderHook(() => useUpdateChecklistItemStatus("es_1"), { wrapper: createWrapper() });

    act(() => {
      result.current.mutate({ id: "item_1", status: "completed" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ message: "Cannot update a cancelled item." });
  });
});
