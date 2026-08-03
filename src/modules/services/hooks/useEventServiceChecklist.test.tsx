import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/queries/services", () => ({
  getEventServiceChecklistItems: vi.fn(),
}));

import { useEventServiceChecklist } from "@/modules/services/hooks/useEventServiceChecklist";
import { getEventServiceChecklistItems } from "@/lib/queries/services";
import { createWrapper } from "@/modules/services/hooks/testUtils";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useEventServiceChecklist", () => {
  it("stays disabled until eventId is known, issuing no fetch", () => {
    renderHook(() => useEventServiceChecklist("es_1", undefined), { wrapper: createWrapper() });
    expect(getEventServiceChecklistItems).not.toHaveBeenCalled();
  });

  it("fetches once eventId resolves, passing both ids through", async () => {
    vi.mocked(getEventServiceChecklistItems).mockResolvedValue([{ id: "item_1" }] as never);
    const { result } = renderHook(() => useEventServiceChecklist("es_1", "event_1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(getEventServiceChecklistItems).toHaveBeenCalledWith("es_1", "event_1");
    expect(result.current.data).toEqual([{ id: "item_1" }]);
  });
});
