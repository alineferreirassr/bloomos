import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getInvoices: vi.fn(),
  getExpenses: vi.fn(),
  getEvents: vi.fn(),
  listServices: vi.fn(),
  listEventServicesByEvent: vi.fn(),
}));

import { getProfitabilityData } from "@/modules/analytics/profitability/getProfitabilityData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getInvoices, getExpenses, getEvents, listServices, listEventServicesByEvent } from "@/lib/data";

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
  vi.mocked(getInvoices).mockResolvedValue([] as never);
  vi.mocked(getExpenses).mockResolvedValue([] as never);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(listServices).mockResolvedValue([] as never);
  vi.mocked(listEventServicesByEvent).mockResolvedValue([] as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getProfitabilityData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getProfitabilityData("90d");
    expect(result.success).toBe(false);
  });

  it("computes gross profit on an accrual basis (invoiced) and net profit on a cash basis (collected)", async () => {
    setUpDefaults();
    vi.mocked(getInvoices).mockResolvedValue([
      { id: "i1", status: "issued", issue_date: "2026-07-15T00:00:00.000Z", total_minor: 100000 },
    ] as never);
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, amount_minor: 60000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-15T00:00:00.000Z" },
    ] as never);
    vi.mocked(getExpenses).mockResolvedValue([
      { id: "e1", event_id: null, status: "paid", amount_minor: 20000, transaction_date: "2026-07-15T00:00:00.000Z" },
    ] as never);

    const result = await getProfitabilityData("90d");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grossProfitMinor).toBe(80000); // 100000 invoiced - 20000 cost
      expect(result.data.netProfitMinor).toBe(40000); // 60000 collected - 20000 cost
    }
  });

  it("excludes voided invoices and cancelled expenses", async () => {
    setUpDefaults();
    vi.mocked(getInvoices).mockResolvedValue([
      { id: "i1", status: "voided", issue_date: "2026-07-15T00:00:00.000Z", total_minor: 999999 },
    ] as never);
    vi.mocked(getExpenses).mockResolvedValue([
      { id: "e1", event_id: null, status: "cancelled", amount_minor: 999999, transaction_date: "2026-07-15T00:00:00.000Z" },
    ] as never);

    const result = await getProfitabilityData("90d");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.grossProfitMinor).toBe(0);
      expect(result.data.netProfitMinor).toBe(0);
    }
  });

  it("computes cost per event only over events that actually have a recorded cost", async () => {
    setUpDefaults();
    vi.mocked(getExpenses).mockResolvedValue([
      { id: "e1", event_id: "ev1", status: "paid", amount_minor: 10000, transaction_date: "2026-07-15T00:00:00.000Z" },
      { id: "e2", event_id: "ev1", status: "paid", amount_minor: 20000, transaction_date: "2026-07-16T00:00:00.000Z" },
      { id: "e3", event_id: "ev2", status: "paid", amount_minor: 30000, transaction_date: "2026-07-16T00:00:00.000Z" },
    ] as never);

    const result = await getProfitabilityData("90d");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.costPerEventMinor).toBe(30000); // (10000+20000+30000) / 2 events
  });

  it("allocates revenue and cost per service proportionally, ranking most/least profitable", async () => {
    setUpDefaults();
    vi.mocked(getEvents).mockResolvedValue([{ id: "ev1", title: "Wedding" }] as never);
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: "ev1", amount_minor: 10000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-15T00:00:00.000Z" },
    ] as never);
    vi.mocked(getExpenses).mockResolvedValue([
      { id: "e1", event_id: "ev1", status: "paid", amount_minor: 4000, transaction_date: "2026-07-15T00:00:00.000Z" },
    ] as never);
    vi.mocked(listServices).mockResolvedValue([{ id: "svc1", name: "Photography" }, { id: "svc2", name: "Florals" }] as never);
    vi.mocked(listEventServicesByEvent).mockResolvedValue([
      { id: "es1", event_id: "ev1", service_id: "svc1", name: "Photography", price_minor: 8000 },
      { id: "es2", event_id: "ev1", service_id: "svc2", name: "Florals", price_minor: 2000 },
    ] as never);

    const result = await getProfitabilityData("90d");
    expect(result.success).toBe(true);
    if (result.success) {
      const photography = result.data.mostProfitableServices.find((s) => s.serviceId === "svc1");
      expect(photography).toEqual({ serviceId: "svc1", name: "Photography", revenueMinor: 8000, costMinor: 3200, profitMinor: 4800, marginPercent: 60 });
    }
  });
});
