import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";

vi.mock("@/modules/ai/fetchEventContext.server", () => ({
  fetchEventContextRecord: vi.fn(),
}));

import { eventContextBuilder } from "@/modules/ai/contextBuilders/eventContextBuilder";
import { fetchEventContextRecord } from "@/modules/ai/fetchEventContext.server";

afterEach(() => vi.clearAllMocks());

describe("eventContextBuilder", () => {
  it("returns null when no eventId ref is supplied", async () => {
    const result = await eventContextBuilder.build({ workspaceId: "ws_1", refs: {} });
    expect(result).toBeNull();
    expect(fetchEventContextRecord).not.toHaveBeenCalled();
  });

  it("returns null when the Event doesn't exist", async () => {
    vi.mocked(fetchEventContextRecord).mockResolvedValue(null);
    const result = await eventContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "missing" } });
    expect(result).toBeNull();
  });

  it("builds the Event Operations Brief context for a matching workspace", async () => {
    const record = { event: makeEvent({ id: "event_1", workspace_id: "ws_1" }), client: null, checklist: [], schedule: [] };
    vi.mocked(fetchEventContextRecord).mockResolvedValue(record);

    const result = await eventContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(result?.source).toBe("fetchEventContextRecord+buildEventOperationsBriefContext");
    expect(result?.data).toMatchObject({ event: expect.objectContaining({ id: "event_1" }) });
  });
});
