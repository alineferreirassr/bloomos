import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/lib/data", () => ({
  assignServiceToEvent: vi.fn(),
  transitionEventServiceStatus: vi.fn(),
  removeEventService: vi.fn(),
}));

import { useAssignServiceToEvent, useTransitionEventServiceStatus, useRemoveEventService } from "@/modules/services/hooks/useEventAssignmentMutations";
import { assignServiceToEvent, transitionEventServiceStatus, removeEventService } from "@/lib/data";
import { serviceKeys } from "@/modules/services/hooks/serviceKeys";
import { createTestQueryClient, createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAssignServiceToEvent", () => {
  it("invalidates assignmentWorkspace(eventId), lists(), and editor(serviceId) — usageCount changed on the assigned Service", async () => {
    vi.mocked(assignServiceToEvent).mockResolvedValue({ success: true, data: { id: "es_1" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useAssignServiceToEvent("event_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync({ service_id: "service_1", selected_add_on_ids: [] });
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.assignmentWorkspace("event_1"), serviceKeys.lists(), serviceKeys.editor("service_1")]),
    );
    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });
});

describe("useTransitionEventServiceStatus", () => {
  it("invalidates its own workspace and the Event's assignment list, but NEVER usage-dependent keys for a non-cancelling transition", async () => {
    vi.mocked(transitionEventServiceStatus).mockResolvedValue({ success: true, data: { id: "es_1", status: "confirmed" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTransitionEventServiceStatus("es_1", "event_1", "service_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync("confirmed");
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(expect.arrayContaining([serviceKeys.eventServiceWorkspace("es_1"), serviceKeys.assignmentWorkspace("event_1")]));
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.lists());
    expect(invalidatedKeys).not.toContainEqual(serviceKeys.editor("service_1"));
  });

  it("ALSO invalidates lists()/editor(serviceId) when the transition is specifically to 'cancelled' — the one transition that changes usageCount", async () => {
    vi.mocked(transitionEventServiceStatus).mockResolvedValue({ success: true, data: { id: "es_1", status: "cancelled" } } as never);
    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useTransitionEventServiceStatus("es_1", "event_1", "service_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync("cancelled");
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(expect.arrayContaining([serviceKeys.lists(), serviceKeys.editor("service_1")]));
  });
});

describe("useRemoveEventService", () => {
  it("removes (not invalidates) its own workspace query, and invalidates the assignment list plus usage-dependent catalog keys", async () => {
    vi.mocked(removeEventService).mockResolvedValue({ success: true, data: null } as never);
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(serviceKeys.eventServiceWorkspace("es_1"), { eventService: { id: "es_1" } });
    const removeSpy = vi.spyOn(queryClient, "removeQueries");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useRemoveEventService("es_1", "event_1", "service_1"), { wrapper: createWrapper(queryClient) });
    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(removeSpy).toHaveBeenCalledWith({ queryKey: serviceKeys.eventServiceWorkspace("es_1") });
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([serviceKeys.assignmentWorkspace("event_1"), serviceKeys.lists(), serviceKeys.editor("service_1")]),
    );
    expect(queryClient.getQueryData(serviceKeys.eventServiceWorkspace("es_1"))).toBeUndefined();
  });
});
