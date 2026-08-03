import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/data/mock/eventServicesStore", () => ({
  readEventServices: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { eventServiceAssignmentContextBuilder } from "@/modules/ai/contextBuilders/eventServiceAssignmentContextBuilder";
import { readEventServices } from "@/lib/data/mock/eventServicesStore";
import type { EventService } from "@/types/eventService";

function makeEventService(overrides: Partial<EventService> = {}): EventService {
  return {
    id: "es_1",
    workspace_id: "ws_1",
    event_id: "event_1",
    service_id: "svc_1",
    service_version_id: "sv_1",
    name: "Photography",
    name_template_value: "Photography",
    price_minor: 50000,
    price_template_value: 50000,
    currency: "USD",
    selected_add_on_ids: [],
    status: "confirmed",
    assigned_at: "2026-01-01T00:00:00.000Z",
    assigned_by: "user_1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => vi.clearAllMocks());

describe("eventServiceAssignmentContextBuilder", () => {
  it("returns null when no eventId ref is supplied", async () => {
    const result = await eventServiceAssignmentContextBuilder.build({ workspaceId: "ws_1", refs: {} });
    expect(result).toBeNull();
    expect(readEventServices).not.toHaveBeenCalled();
  });

  it("returns an empty array (not null) when the Event has no assignments", async () => {
    vi.mocked(readEventServices).mockReturnValue([]);
    const result = await eventServiceAssignmentContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(result?.data).toEqual([]);
  });

  it("excludes cancelled assignments", async () => {
    vi.mocked(readEventServices).mockReturnValue([makeEventService({ id: "es_1", status: "confirmed" }), makeEventService({ id: "es_2", status: "cancelled" })]);
    const result = await eventServiceAssignmentContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect(result?.data).toEqual([{ eventServiceId: "es_1", label: "Photography", priceMinor: 50000, currency: "USD" }]);
  });

  it("only includes assignments for the requested Event", async () => {
    vi.mocked(readEventServices).mockReturnValue([makeEventService({ id: "es_1", event_id: "event_1" }), makeEventService({ id: "es_2", event_id: "event_other" })]);
    const result = await eventServiceAssignmentContextBuilder.build({ workspaceId: "ws_1", refs: { eventId: "event_1" } });
    expect((result?.data as { eventServiceId: string }[]).map((item) => item.eventServiceId)).toEqual(["es_1"]);
  });
});
