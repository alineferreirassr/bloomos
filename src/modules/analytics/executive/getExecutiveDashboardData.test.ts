import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getContracts: vi.fn(),
  getInvoices: vi.fn(),
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
  getEvents: vi.fn(),
  getLeads: vi.fn(),
  listInventoryItems: vi.fn(),
}));
vi.mock("@/modules/operations/operationsDashboardData", () => ({
  getOperationsDashboardData: vi.fn(),
}));

import { getExecutiveDashboardData } from "@/modules/analytics/executive/getExecutiveDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getContracts, getInvoices, getPayments, getExpenses, getEvents, getLeads, listInventoryItems } from "@/lib/data";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import * as clockModule from "@/core/time/clock";

const NOW = new Date("2026-07-15T12:00:00.000Z");

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const emptyOperationsData = {
  eventsToday: [],
  upcomingEvents: [],
  lateTaskCount: 0,
  totalChecklistItemCount: 0,
  lowStockItems: [],
  damagedItems: [],
  overduePurchases: [],
  unconfirmedVendorAssignmentCount: 0,
  financialSummary: { revenue_this_month_minor: 0, collected_this_month_minor: 0, outstanding_receivables_minor: 0, overdue_receivables_minor: 0, expenses_this_month_minor: 0, gross_profit_minor: 0, net_profit_minor: 0, deposits_pending_minor: 0, refunds_this_month_minor: 0 },
  eventHealthScores: [],
};

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getContracts).mockResolvedValue([] as never);
  vi.mocked(getInvoices).mockResolvedValue([] as never);
  vi.mocked(getPayments).mockResolvedValue([] as never);
  vi.mocked(getExpenses).mockResolvedValue([] as never);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(getLeads).mockResolvedValue([] as never);
  vi.mocked(listInventoryItems).mockResolvedValue([] as never);
  vi.mocked(getOperationsDashboardData).mockResolvedValue(emptyOperationsData as never);
  vi.spyOn(clockModule, "clockNow").mockReturnValue(NOW);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getExecutiveDashboardData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getExecutiveDashboardData();
    expect(result.success).toBe(false);
  });

  it("requires the analytics.view permission even for an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await getExecutiveDashboardData();
    expect(result.success).toBe(false);
  });

  it("returns a fully-populated, zeroed dashboard for an empty workspace rather than throwing", async () => {
    setUpDefaults();
    const result = await getExecutiveDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.todaysRevenueMinor).toBe(0);
      expect(result.data.businessHealth.score).toBe(100);
      // groupByMonth zero-fills every month in the lookback window even with no payments at all, so the forecast still has real (zero-value) historical points to project flat from.
      expect(result.data.forecast.projected.every((p) => p.value === 0)).toBe(true);
    }
  });

  it("sums only today's succeeding, non-refund payments into Today's Revenue", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, contract_id: null, invoice_id: null, amount_minor: 10000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-15T09:00:00.000Z", reference: null, notes: null, payment_method: "manual", created_at: "2026-07-15T09:00:00.000Z", updated_at: "2026-07-15T09:00:00.000Z" },
      { id: "p2", client_id: "c1", event_id: null, contract_id: null, invoice_id: null, amount_minor: 5000, currency: "usd", status: "succeeded", payment_type: "refund", transaction_date: "2026-07-15T09:00:00.000Z", reference: null, notes: null, payment_method: "manual", created_at: "2026-07-15T09:00:00.000Z", updated_at: "2026-07-15T09:00:00.000Z" },
      { id: "p3", client_id: "c1", event_id: null, contract_id: null, invoice_id: null, amount_minor: 99999, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-14T09:00:00.000Z", reference: null, notes: null, payment_method: "manual", created_at: "2026-07-14T09:00:00.000Z", updated_at: "2026-07-14T09:00:00.000Z" },
    ] as never);

    const result = await getExecutiveDashboardData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.todaysRevenueMinor).toBe(10000);
  });

  it("computes pipeline value from open leads' budget, excluding won/lost leads", async () => {
    setUpDefaults();
    vi.mocked(getLeads).mockResolvedValue([
      { id: "l1", workspace_id: "ws_1", first_name: "A", last_name: "B", email: "a@b.com", phone: null, instagram: null, source: "referral", event_type: null, event_date: null, location: null, budget_min: 1000, budget_max: 2000, message: null, status: "qualified", assigned_to: null, converted_client_id: null, created_at: "2026-06-01T00:00:00.000Z", updated_at: "2026-06-01T00:00:00.000Z", archived_at: null },
      { id: "l2", workspace_id: "ws_1", first_name: "C", last_name: "D", email: "c@d.com", phone: null, instagram: null, source: "referral", event_type: null, event_date: null, location: null, budget_min: 500, budget_max: null, message: null, status: "converted", assigned_to: null, converted_client_id: "client_1", created_at: "2026-06-01T00:00:00.000Z", updated_at: "2026-06-01T00:00:00.000Z", archived_at: null },
    ] as never);

    const result = await getExecutiveDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pipelineValueMinor).toBe(200000); // $2000 -> minor units, only the open (qualified) lead counts
      expect(result.data.conversionRatePercent).toBe(50); // 1 of 2 leads converted
    }
  });

  it("passes through the operations dashboard's own event health scores into the Business Health Score without re-deriving them", async () => {
    setUpDefaults();
    vi.mocked(getOperationsDashboardData).mockResolvedValue({
      ...emptyOperationsData,
      eventHealthScores: [{ event: {} as never, score: 20 }, { event: {} as never, score: 90 }],
    } as never);

    const result = await getExecutiveDashboardData();
    expect(result.success).toBe(true);
    if (result.success) {
      const risk = result.data.businessHealth.dimensions.find((d) => d.dimension === "risk");
      expect(risk?.factors.some((f) => f.label.includes("1 open critical risk"))).toBe(true);
    }
  });
});
