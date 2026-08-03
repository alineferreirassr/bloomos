import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
  getEvents: vi.fn(),
  getClients: vi.fn(),
}));

import { getBenchmarkData } from "@/modules/analytics/benchmark/getBenchmarkData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, getClients } from "@/lib/data";
import * as clockModule from "@/core/time/clock";

const NOW = new Date("2026-07-15T12:00:00.000Z");

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getPayments).mockResolvedValue([] as never);
  vi.mocked(getExpenses).mockResolvedValue([] as never);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(getClients).mockResolvedValue([] as never);
  vi.spyOn(clockModule, "clockNow").mockReturnValue(NOW);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getBenchmarkData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getBenchmarkData();
    expect(result.success).toBe(false);
  });

  it("computes revenue for this month from real succeeding, non-refund payments", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, amount_minor: 50000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-10T00:00:00.000Z" },
      { id: "p2", client_id: "c1", event_id: null, amount_minor: 99999, currency: "usd", status: "succeeded", payment_type: "refund", transaction_date: "2026-07-10T00:00:00.000Z" },
    ] as never);

    const result = await getBenchmarkData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.revenue.values.find((v) => v.period === "thisMonth")?.value).toBe(50000);
    }
  });

  it("computes profit as revenue minus expenses for the same period", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, amount_minor: 50000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-10T00:00:00.000Z" },
    ] as never);
    vi.mocked(getExpenses).mockResolvedValue([{ id: "e1", event_id: null, status: "paid", amount_minor: 20000, transaction_date: "2026-07-10T00:00:00.000Z" }] as never);

    const result = await getBenchmarkData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.profit.values.find((v) => v.period === "thisMonth")?.value).toBe(30000);
    }
  });

  it("counts events booked and new clients over each benchmark period, excluding cancelled events", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([
      { id: "e1", event_date: "2026-07-10", status: "confirmed" },
      { id: "e2", event_date: "2026-07-11", status: "cancelled" },
    ] as never);
    vi.mocked(getClients).mockResolvedValue([{ id: "c1", created_at: "2026-07-10T00:00:00.000Z" }] as never);

    const result = await getBenchmarkData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.eventsBooked.values.find((v) => v.period === "thisMonth")?.value).toBe(1);
      expect(result.data.newClients.values.find((v) => v.period === "thisMonth")?.value).toBe(1);
    }
  });
});
