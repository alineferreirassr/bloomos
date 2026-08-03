import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getClients: vi.fn(),
  getEvents: vi.fn(),
  getContracts: vi.fn(),
  getInvoices: vi.fn(),
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
}));

import { getClientIntelligenceData } from "@/modules/analytics/clientIntelligence/getClientIntelligenceData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getClients, getEvents, getContracts, getInvoices, getPayments, getExpenses } from "@/lib/data";
import * as clockModule from "@/core/time/clock";

const NOW = new Date("2026-07-29T12:00:00.000Z");

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["clients.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function client(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "c1", first_name: "Ana", last_name: "Silva", is_returning: false, ...overrides };
}

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getClients).mockResolvedValue([] as never);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(getContracts).mockResolvedValue([] as never);
  vi.mocked(getInvoices).mockResolvedValue([] as never);
  vi.mocked(getPayments).mockResolvedValue([] as never);
  vi.mocked(getExpenses).mockResolvedValue([] as never);
  vi.spyOn(clockModule, "clockNow").mockReturnValue(NOW);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getClientIntelligenceData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getClientIntelligenceData();
    expect(result.success).toBe(false);
  });

  it("counts returning vs one-time clients using the real is_returning field", async () => {
    setUpDefaults();
    vi.mocked(getClients).mockResolvedValue([client({ id: "c1", is_returning: true }), client({ id: "c2", is_returning: false })] as never);
    vi.mocked(getEvents).mockResolvedValue([
      { id: "e1", client_id: "c1", event_date: "2026-08-01" },
      { id: "e2", client_id: "c2", event_date: "2026-08-01" },
    ] as never);

    const result = await getClientIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.returningClientCount).toBe(1);
      expect(result.data.oneTimeClientCount).toBe(1);
      expect(result.data.retentionRatePercent).toBe(50);
    }
  });

  it("never treats a brand-new client with zero activity as inactive", async () => {
    setUpDefaults();
    vi.mocked(getClients).mockResolvedValue([client({ id: "c1" })] as never);

    const result = await getClientIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inactiveClientCount).toBe(0);
      expect(result.data.clients[0].isInactive).toBe(false);
    }
  });

  it("flags a client inactive only after having been active and going quiet for over a year", async () => {
    setUpDefaults();
    vi.mocked(getClients).mockResolvedValue([client({ id: "c1" })] as never);
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, amount_minor: 10000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2024-01-01T00:00:00.000Z" },
    ] as never);

    const result = await getClientIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.inactiveClientCount).toBe(1);
  });

  it("marks high-value clients as those above the workspace's own average lifetime spend", async () => {
    setUpDefaults();
    vi.mocked(getClients).mockResolvedValue([client({ id: "c1", is_returning: true }), client({ id: "c2" })] as never);
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, amount_minor: 900000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-01T00:00:00.000Z" },
      { id: "p2", client_id: "c2", event_id: null, amount_minor: 10000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-01T00:00:00.000Z" },
    ] as never);

    const result = await getClientIntelligenceData();
    expect(result.success).toBe(true);
    if (result.success) {
      const c1 = result.data.clients.find((c) => c.clientId === "c1");
      expect(c1?.isHighValue).toBe(true);
      expect(c1?.isVip).toBe(true); // high value AND returning
    }
  });
});
