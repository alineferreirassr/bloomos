import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
  getInvoices: vi.fn(),
  getLeads: vi.fn(),
  getClients: vi.fn(),
}));
vi.mock("@/modules/operations/operationsDashboardData", () => ({
  getOperationsDashboardData: vi.fn(),
}));
vi.mock("@/modules/analytics/clientIntelligence/getClientIntelligenceData", () => ({
  getClientIntelligenceData: vi.fn(),
}));

import { getExecutiveInsightsData } from "@/modules/analytics/insights/getExecutiveInsightsData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getInvoices, getLeads, getClients } from "@/lib/data";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import { getClientIntelligenceData } from "@/modules/analytics/clientIntelligence/getClientIntelligenceData";
import { EXECUTIVE_INSIGHT_CATEGORIES } from "@/types/businessIntelligence";
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

const emptyOperationsData = {
  eventsToday: [],
  upcomingEvents: [],
  lateTaskCount: 0,
  totalChecklistItemCount: 0,
  lowStockItems: [],
  damagedItems: [],
  overduePurchases: [],
  unconfirmedVendorAssignmentCount: 0,
  confirmedVendorIds: [],
  assignedTeamMemberNames: [],
  financialSummary: {},
  eventHealthScores: [],
};

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getPayments).mockResolvedValue([] as never);
  vi.mocked(getExpenses).mockResolvedValue([] as never);
  vi.mocked(getInvoices).mockResolvedValue([] as never);
  vi.mocked(getLeads).mockResolvedValue([] as never);
  vi.mocked(getClients).mockResolvedValue([] as never);
  vi.mocked(getOperationsDashboardData).mockResolvedValue(emptyOperationsData as never);
  vi.mocked(getClientIntelligenceData).mockResolvedValue({ success: true, data: { vipClientCount: 0, inactiveClientCount: 0 } } as never);
  vi.spyOn(clockModule, "clockNow").mockReturnValue(NOW);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getExecutiveInsightsData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getExecutiveInsightsData();
    expect(result.success).toBe(false);
  });

  it("produces one insight per category for an empty workspace, never throwing", async () => {
    setUpDefaults();
    const result = await getExecutiveInsightsData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.map((i) => i.category).sort()).toEqual([...EXECUTIVE_INSIGHT_CATEGORIES].sort());
  });

  it("passes VIP/inactive client counts through from getClientIntelligenceData without recomputing them", async () => {
    setUpDefaults();
    vi.mocked(getClientIntelligenceData).mockResolvedValue({ success: true, data: { vipClientCount: 5, inactiveClientCount: 2 } } as never);

    const result = await getExecutiveInsightsData();
    expect(result.success).toBe(true);
    if (result.success) {
      const clientTrend = result.data.find((i) => i.category === "clientTrend");
      expect(clientTrend?.title).toContain("5 VIP");
    }
  });

  it("degrades gracefully to zero counts if Client Intelligence itself fails", async () => {
    setUpDefaults();
    vi.mocked(getClientIntelligenceData).mockResolvedValue({ success: false, error: "nope" } as never);

    const result = await getExecutiveInsightsData();
    expect(result.success).toBe(true);
  });
});
