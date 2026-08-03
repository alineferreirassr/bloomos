import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
  getEvents: vi.fn(),
  listInventoryItems: vi.fn(),
  listEventServicesByEvent: vi.fn(),
  listEventServiceInventoryRequirements: vi.fn(),
}));

import { getFinancialForecastData } from "@/modules/analytics/forecast/getFinancialForecastData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, listInventoryItems, listEventServicesByEvent, listEventServiceInventoryRequirements } from "@/lib/data";
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
  vi.mocked(listInventoryItems).mockResolvedValue([] as never);
  vi.mocked(listEventServicesByEvent).mockResolvedValue([] as never);
  vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([] as never);
  vi.spyOn(clockModule, "clockNow").mockReturnValue(NOW);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getFinancialForecastData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getFinancialForecastData();
    expect(result.success).toBe(false);
  });

  it("derives cash flow forecast as projected revenue minus projected expenses per month", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        id: `p${i}`,
        client_id: "c1",
        event_id: null,
        amount_minor: 100000 * (i + 1),
        currency: "usd",
        status: "succeeded",
        payment_type: "deposit",
        transaction_date: `2026-0${i + 3}-15T00:00:00.000Z`,
      })) as never,
    );
    vi.mocked(getExpenses).mockResolvedValue(
      Array.from({ length: 4 }, (_, i) => ({
        id: `e${i}`,
        event_id: null,
        status: "paid",
        amount_minor: 20000,
        transaction_date: `2026-0${i + 3}-15T00:00:00.000Z`,
      })) as never,
    );

    const result = await getFinancialForecastData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cashFlowForecast.length).toBe(result.data.revenueForecast.projected.length);
      for (const point of result.data.cashFlowForecast) {
        const revenue = result.data.revenueForecast.projected.find((p) => p.label === point.month)?.value ?? 0;
        const expense = result.data.expenseForecast.projected.find((p) => p.label === point.month)?.value ?? 0;
        expect(point.projectedMinor).toBe(revenue - expense);
      }
    }
  });

  it("predicts busy months from historical event counts by calendar month, excluding cancelled/archived events", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([
      { id: "e1", event_date: "2025-06-01", status: "completed" },
      { id: "e2", event_date: "2026-06-15", status: "confirmed" },
      { id: "e3", event_date: "2026-06-20", status: "cancelled" },
      { id: "e4", event_date: "2025-12-01", status: "completed" },
    ] as never);

    const result = await getFinancialForecastData();
    expect(result.success).toBe(true);
    if (result.success) {
      const june = result.data.predictedBusyMonths.find((m) => m.month === "June");
      expect(june?.historicalEventCount).toBe(2); // e1 + e2, not the cancelled e3
    }
  });

  it("flags inventory needs only for items both low in stock and unfulfilled-required by an upcoming event", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([{ id: "e1", event_date: "2026-08-01", status: "confirmed" }] as never);
    vi.mocked(listInventoryItems).mockResolvedValue([
      { id: "item1", name: "Candles", quantity_available: 2, reorder_level: 10 },
      { id: "item2", name: "Vases", quantity_available: 50, reorder_level: 10 }, // well-stocked, should be excluded
    ] as never);
    vi.mocked(listEventServicesByEvent).mockResolvedValue([{ id: "es1", event_id: "e1", service_id: "svc1" }] as never);
    vi.mocked(listEventServiceInventoryRequirements).mockResolvedValue([
      { id: "req1", event_service_id: "es1", inventory_item_id: "item1", item_name: "Candles", quantity: 20, is_fulfilled: false },
      { id: "req2", event_service_id: "es1", inventory_item_id: "item2", item_name: "Vases", quantity: 5, is_fulfilled: false },
    ] as never);

    const result = await getFinancialForecastData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inventoryNeeds).toEqual([{ itemId: "item1", itemName: "Candles", quantityAvailable: 2, reorderLevel: 10, neededForUpcomingEvents: 20 }]);
    }
  });
});
