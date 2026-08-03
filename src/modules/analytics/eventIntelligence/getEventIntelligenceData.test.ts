import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getEvents: vi.fn(),
  listServices: vi.fn(),
  listEventServicesByEvent: vi.fn(),
}));

import { getEventIntelligenceData } from "@/modules/analytics/eventIntelligence/getEventIntelligenceData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getEvents, listServices, listEventServicesByEvent } from "@/lib/data";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function event(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "e1",
    status: "confirmed",
    event_date: "2026-08-15",
    created_at: "2026-06-01T00:00:00.000Z",
    guest_count: null,
    budget_min: null,
    budget_max: null,
    start_time: null,
    end_time: null,
    ...overrides,
  };
}

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(listServices).mockResolvedValue([] as never);
  vi.mocked(listEventServicesByEvent).mockResolvedValue([] as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getEventIntelligenceData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getEventIntelligenceData();
    expect(result.success).toBe(false);
  });

  it("buckets events by calendar month across years for seasonality", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([event({ id: "e1", event_date: "2025-06-10" }), event({ id: "e2", event_date: "2026-06-20" }), event({ id: "e3", event_date: "2026-01-05" })] as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seasonality.find((s) => s.month === "Jun")?.count).toBe(2);
      expect(result.data.seasonality.find((s) => s.month === "Jan")?.count).toBe(1);
      expect(result.data.seasonality).toHaveLength(12);
    }
  });

  it("computes cancellation rate excluding archived events from the denominator", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([event({ id: "e1", status: "cancelled" }), event({ id: "e2", status: "confirmed" }), event({ id: "e3", status: "archived" })] as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.cancellationRatePercent).toBe(50); // 1 of 2 non-archived
  });

  it("computes average planning days from created_at to event_date", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([event({ id: "e1", created_at: "2026-06-01T00:00:00.000Z", event_date: "2026-06-11" })] as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.averagePlanningDays).toBe(10);
  });

  it("averages event size only over events with a recorded guest_count", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([event({ id: "e1", guest_count: 100 }), event({ id: "e2", guest_count: 200 }), event({ id: "e3", guest_count: null })] as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.averageEventSize).toBe(150);
  });

  it("uses the midpoint of budget_min/budget_max when both are present", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([event({ id: "e1", budget_min: 1000, budget_max: 2000 })] as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.averageBudgetMajor).toBe(1500);
  });

  it("computes duration from start_time/end_time, handling an overnight span", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([
      event({ id: "e1", start_time: "18:00", end_time: "23:00" }),
      event({ id: "e2", start_time: "22:00", end_time: "02:00" }),
    ] as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.averageDurationHours).toBe(4.5); // (5 + 4) / 2
  });

  it("ranks popular services by distinct-event count, excluding cancelled/archived events", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([event({ id: "e1", status: "confirmed" }), event({ id: "e2", status: "confirmed" }), event({ id: "e3", status: "cancelled" })] as never);
    vi.mocked(listServices).mockResolvedValue([{ id: "svc1", name: "Photography" }] as never);
    vi.mocked(listEventServicesByEvent).mockImplementation(async (eventId: string) => (eventId === "e3" ? [] : [{ id: `es-${eventId}`, event_id: eventId, service_id: "svc1", name: "Photography" }]) as never);

    const result = await getEventIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.popularServices).toEqual([{ serviceId: "svc1", name: "Photography", eventCount: 2 }]);
  });
});
