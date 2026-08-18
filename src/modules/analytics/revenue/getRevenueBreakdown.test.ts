import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getEvents: vi.fn(),
  getClients: vi.fn(),
  listEventServicesByEvent: vi.fn(),
  listServices: vi.fn(),
}));

import { getRevenueBreakdown } from "@/modules/analytics/revenue/getRevenueBreakdown";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getEvents, getClients, listEventServicesByEvent, listServices } from "@/lib/data";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view", "finance.amounts.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function payment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "p1",
    client_id: "c1",
    event_id: null,
    contract_id: null,
    invoice_id: null,
    amount_minor: 10000,
    currency: "usd",
    status: "succeeded",
    payment_type: "deposit",
    transaction_date: "2026-07-15T09:00:00.000Z",
    reference: null,
    notes: null,
    payment_method: "manual",
    created_at: "2026-07-15T09:00:00.000Z",
    updated_at: "2026-07-15T09:00:00.000Z",
    ...overrides,
  };
}

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getPayments).mockResolvedValue([] as never);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(getClients).mockResolvedValue([] as never);
  vi.mocked(listEventServicesByEvent).mockResolvedValue([] as never);
  vi.mocked(listServices).mockResolvedValue([] as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getRevenueBreakdown", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getRevenueBreakdown("month", "90d");
    expect(result.success).toBe(false);
  });

  it("excludes refunds and non-succeeding payments from the total", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([
      payment({ id: "p1", amount_minor: 10000, payment_type: "deposit" }),
      payment({ id: "p2", amount_minor: 5000, payment_type: "refund" }),
      payment({ id: "p3", amount_minor: 3000, status: "pending" }),
    ] as never);

    const result = await getRevenueBreakdown("month", "90d");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalMinor).toBe(10000);
  });

  it("groups by client with a real drill-down target", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([payment({ id: "p1", client_id: "c1", amount_minor: 10000 }), payment({ id: "p2", client_id: "c1", amount_minor: 5000 })] as never);
    vi.mocked(getClients).mockResolvedValue([{ id: "c1", first_name: "Ana", last_name: "Silva", source: "referral" }] as never);

    const result = await getRevenueBreakdown("client", "90d");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toEqual([{ key: "c1", label: "Ana Silva", revenueMinor: 15000, drillDown: { kind: "clients", label: "View client", href: "/clients/c1" } }]);
    }
  });

  it("groups by source using the paying client's own source field, with no drill-down", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([payment({ id: "p1", client_id: "c1", amount_minor: 10000 })] as never);
    vi.mocked(getClients).mockResolvedValue([{ id: "c1", first_name: "Ana", last_name: "Silva", source: "instagram" }] as never);

    const result = await getRevenueBreakdown("source", "90d");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rows).toEqual([{ key: "instagram", label: "instagram", revenueMinor: 10000, drillDown: null }]);
  });

  it("allocates a payment's amount across its event's services proportionally by price share", async () => {
    setUpDefaults();
    vi.mocked(getPayments).mockResolvedValue([payment({ id: "p1", event_id: "e1", amount_minor: 10000 })] as never);
    vi.mocked(getEvents).mockResolvedValue([{ id: "e1", title: "Ana's Wedding" }] as never);
    vi.mocked(listServices).mockResolvedValue([{ id: "svc1", name: "Photography" }, { id: "svc2", name: "Florals" }] as never);
    vi.mocked(listEventServicesByEvent).mockResolvedValue([
      { id: "es1", event_id: "e1", service_id: "svc1", name: "Photography", price_minor: 7500 },
      { id: "es2", event_id: "e1", service_id: "svc2", name: "Florals", price_minor: 2500 },
    ] as never);

    const result = await getRevenueBreakdown("service", "90d");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rows).toEqual([
        { key: "svc1", label: "Photography", revenueMinor: 7500, drillDown: { kind: "services", label: "View service", href: "/services/svc1" } },
        { key: "svc2", label: "Florals", revenueMinor: 2500, drillDown: { kind: "services", label: "View service", href: "/services/svc2" } },
      ]);
    }
  });

  it("zero-fills every month bucket in the window for the month dimension", async () => {
    setUpDefaults();
    const result = await getRevenueBreakdown("month", "90d");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rows.length).toBeGreaterThan(0);
  });
});
