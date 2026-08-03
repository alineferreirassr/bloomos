import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  createService: vi.fn(),
  updateService: vi.fn(),
  activateService: vi.fn(),
  deactivateService: vi.fn(),
  archiveService: vi.fn(),
  restoreService: vi.fn(),
}));

import { useCreateService, useUpdateService, useActivateService } from "@/modules/services/hooks/useServiceMutations";
import { createService, updateService, activateService } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCreateService", () => {
  it("calls the repository directly and invalidates only lists() — no editor/health/versions key exists yet for a brand-new Service", async () => {
    vi.mocked(createService).mockResolvedValue({ success: true, data: { id: "service_1" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateService(), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ category_id: null, name: "Photography", description: null });
    });

    expect(createService).toHaveBeenCalledWith({ category_id: null, name: "Photography", description: null });
    expect(invalidateSpy).toHaveBeenCalledTimes(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: serviceKeys.lists() });
  });

  it("rejects with a ServiceMutationError and invalidates nothing when the repository returns a validation failure", async () => {
    vi.mocked(createService).mockResolvedValue({ success: false, error: "Please fix the highlighted fields.", fieldErrors: { name: "Name is required" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateService(), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await expect(result.current.mutateAsync({ category_id: null, name: "", description: null })).rejects.toThrow("Please fix the highlighted fields.");
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe("useUpdateService", () => {
  it("invalidates exactly editor(id) and lists() — never health/versions/publishPreview/templates, which don't read name/category/description", async () => {
    vi.mocked(updateService).mockResolvedValue({ success: true, data: { id: "service_1", name: "New name" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateService("service_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ category_id: null, name: "New name", description: null });
    });

    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(expect.arrayContaining([serviceKeys.editor("service_1"), serviceKeys.lists()]));
  });
});

describe("useActivateService", () => {
  it("invalidates editor(id), lists(), and the healthDashboards() family — status is filterable/visible in all three", async () => {
    vi.mocked(activateService).mockResolvedValue({ success: true, data: { id: "service_1", status: "active" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useActivateService(), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync("service_1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const invalidatedKeys = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.editor("service_1"), serviceKeys.lists(), serviceKeys.healthDashboards()]),
    );
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });
});
