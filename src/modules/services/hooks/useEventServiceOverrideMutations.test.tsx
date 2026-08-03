import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  updateEventServiceOverrides: vi.fn(),
}));

import { useUpdateEventServiceOverrides } from "@/modules/services/hooks/useEventServiceOverrideMutations";
import { updateEventServiceOverrides } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";
import { ServiceMutationError, classifyThrownError } from "@/modules/services/hooks/errorContract";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useUpdateEventServiceOverrides", () => {
  it("calls the repository directly (not a ServicesQueries read function) and invalidates only eventServiceWorkspace(id) when no eventId is given", async () => {
    vi.mocked(updateEventServiceOverrides).mockResolvedValue({ success: true, data: { id: "es_1", name: "Custom" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEventServiceOverrides("es_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ name: "Custom" });
    });

    expect(updateEventServiceOverrides).toHaveBeenCalledWith("es_1", { name: "Custom" });
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual([serviceKeys.eventServiceWorkspace("es_1")]);
  });

  it("also invalidates assignmentWorkspace(eventId) when an eventId is provided", async () => {
    vi.mocked(updateEventServiceOverrides).mockResolvedValue({ success: true, data: { id: "es_1", price_minor: 75000 } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEventServiceOverrides("es_1", "event_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ price_minor: 75000 });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.eventServiceWorkspace("es_1"), serviceKeys.assignmentWorkspace("event_1")]),
    );
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it("also invalidates assignments(serviceId) when a serviceId is provided", async () => {
    vi.mocked(updateEventServiceOverrides).mockResolvedValue({ success: true, data: { id: "es_1", name: "Custom" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEventServiceOverrides("es_1", undefined, "service_photography"), {
      wrapper: createWrapper(queryClient),
    });
    await act(async () => {
      await result.current.mutateAsync({ name: "Custom" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.eventServiceWorkspace("es_1"), serviceKeys.assignments("service_photography")]),
    );
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it("never invalidates catalog, template, version, or health keys — an instance-level override never touches the catalog Service", async () => {
    vi.mocked(updateEventServiceOverrides).mockResolvedValue({ success: true, data: { id: "es_1" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateEventServiceOverrides("es_1", "event_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ name: "Custom" });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.lists());
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.editor("service_1"));
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.health("service_1"));
  });

  it("has no optimistic update — the eventServiceWorkspace cache is left untouched until the server response resolves", async () => {
    let resolvePromise!: (value: unknown) => void;
    vi.mocked(updateEventServiceOverrides).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      }) as never,
    );
    const queryClient = createTestQueryClient();
    const original = { eventService: { id: "es_1", price_minor: 100 } };
    queryClient.setQueryData(serviceKeys.eventServiceWorkspace("es_1"), original);

    const { result } = renderHook(() => useUpdateEventServiceOverrides("es_1"), { wrapper: createWrapper(queryClient) });

    let pending: Promise<unknown>;
    act(() => {
      pending = result.current.mutateAsync({ price_minor: 1000 });
    });
    // Still exactly the pre-mutation cache value — no optimistic write happened.
    expect(queryClient.getQueryData(serviceKeys.eventServiceWorkspace("es_1"))).toBe(original);

    await act(async () => {
      resolvePromise({ success: true, data: { id: "es_1", price_minor: 1000 } });
      await pending;
    });
  });

  it("preserves the shared error contract on validation failure — rejects with a ServiceMutationError that classifies as 'validation'", async () => {
    vi.mocked(updateEventServiceOverrides).mockResolvedValue({ success: false, error: "Please fix the highlighted fields." } as never);
    const { result } = renderHook(() => useUpdateEventServiceOverrides("es_1"), { wrapper: createWrapper() });

    await act(async () => {
      await expect(result.current.mutateAsync({ price_minor: -1 })).rejects.toThrow("Please fix the highlighted fields.");
    });
    expect(result.current.error).toBeInstanceOf(ServiceMutationError);
    expect(classifyThrownError(result.current.error).kind).toBe("validation");
  });
});
