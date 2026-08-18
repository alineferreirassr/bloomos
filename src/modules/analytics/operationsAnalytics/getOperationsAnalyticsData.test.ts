import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getWorkspaceMembers: vi.fn(),
  getVendors: vi.fn(),
  listPurchases: vi.fn(),
}));
vi.mock("@/modules/operations/operationsDashboardData", () => ({
  getOperationsDashboardData: vi.fn(),
}));
vi.mock("@/modules/operations/operationsReportsData", () => ({
  getOperationsReportsData: vi.fn(),
}));

import { getOperationsAnalyticsData } from "@/modules/analytics/operationsAnalytics/getOperationsAnalyticsData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkspaceMembers, getVendors, listPurchases } from "@/lib/data";
import { getOperationsDashboardData } from "@/modules/operations/operationsDashboardData";
import { getOperationsReportsData } from "@/modules/operations/operationsReportsData";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const emptyDashboardData = {
  eventsToday: [],
  upcomingEvents: [],
  lateTaskCount: 3,
  totalChecklistItemCount: 10,
  lowStockItems: [],
  damagedItems: [],
  overduePurchases: [],
  unconfirmedVendorAssignmentCount: 0,
  confirmedVendorIds: [],
  assignedTeamMemberNames: [],
  financialSummary: {},
  eventHealthScores: [],
};

const emptyReportsData = {
  completedEvents: [],
  totalGrossProfitMinor: 0,
  totalNetProfitMinor: 0,
  vendorPerformance: [],
  inventoryUsage: [],
  purchaseCount: 0,
  financialSummary: {},
};

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
  vi.mocked(getWorkspaceMembers).mockResolvedValue([] as never);
  vi.mocked(getVendors).mockResolvedValue([] as never);
  vi.mocked(listPurchases).mockResolvedValue([] as never);
  vi.mocked(getOperationsDashboardData).mockResolvedValue(emptyDashboardData as never);
  vi.mocked(getOperationsReportsData).mockResolvedValue(emptyReportsData as never);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getOperationsAnalyticsData", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(false);
  });

  it("reports null utilization when there are no active team members/vendors, rather than a fabricated 0%", async () => {
    setUpDefaults();
    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teamUtilizationPercent).toBeNull();
      expect(result.data.vendorUtilizationPercent).toBeNull();
    }
  });

  it("computes team/vendor utilization from distinct assigned names/vendor ids over the active population", async () => {
    setUpDefaults();
    vi.mocked(getWorkspaceMembers).mockResolvedValue([
      { id: "m1", status: "active" },
      { id: "m2", status: "active" },
      { id: "m3", status: "invited" },
    ] as never);
    vi.mocked(getVendors).mockResolvedValue([{ id: "v1", status: "active" }, { id: "v2", status: "active" }] as never);
    vi.mocked(getOperationsDashboardData).mockResolvedValue({
      ...emptyDashboardData,
      assignedTeamMemberNames: ["Sofia"],
      confirmedVendorIds: ["v1"],
    } as never);

    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.teamUtilizationPercent).toBe(50); // 1 of 2 active members
      expect(result.data.vendorUtilizationPercent).toBe(50); // 1 of 2 active vendors
    }
  });

  it("passes through vendor performance and inventory usage from the Operations Reports data untouched", async () => {
    setUpDefaults();
    vi.mocked(getOperationsReportsData).mockResolvedValue({
      ...emptyReportsData,
      vendorPerformance: [{ vendor: { id: "v1" }, purchaseCount: 3, totalSpentMinor: 50000 }],
      purchaseCount: 5,
    } as never);

    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vendorPerformance).toHaveLength(1);
      expect(result.data.purchaseCount).toBe(5);
    }
  });

  it("restates the average event health score as operationalEfficiencyPercent without recomputing it", async () => {
    setUpDefaults();
    vi.mocked(getOperationsDashboardData).mockResolvedValue({
      ...emptyDashboardData,
      eventHealthScores: [{ event: {}, score: 80 }, { event: {}, score: 60 }],
    } as never);

    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.averageEventHealthScore).toBe(70);
      expect(result.data.operationalEfficiencyPercent).toBe(70);
    }
  });

  // Phase 08 — purchase cost is amount-level finance data (Class B): it requires finance.amounts.view,
  // while the surrounding operational metrics stay available under analytics.view.
  it("A. analytics.view + finance.amounts.view → totalPurchaseCostMinor is the real amount", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({
      ...activeSession,
      permissions: ["analytics.view", "finance.amounts.view"],
    });
    vi.mocked(listPurchases).mockResolvedValue([{ total_minor: 30000 }, { total_minor: 12000 }] as never);

    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.totalPurchaseCostMinor).toBe(42000);
  });

  it("B. analytics.view WITHOUT finance.amounts.view → operational metrics stay, totalPurchaseCostMinor === null", async () => {
    setUpDefaults(); // activeSession has ["analytics.view"] only
    vi.mocked(listPurchases).mockResolvedValue([{ total_minor: 30000 }, { total_minor: 12000 }] as never);
    vi.mocked(getWorkspaceMembers).mockResolvedValue([{ id: "m1", status: "active" }] as never);
    vi.mocked(getOperationsDashboardData).mockResolvedValue({
      ...emptyDashboardData,
      assignedTeamMemberNames: ["Sofia"],
    } as never);

    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.totalPurchaseCostMinor).toBeNull();
      // Non-financial Operations Analytics remains fully available under analytics.view.
      expect(result.data.teamUtilizationPercent).toBe(100);
      expect(result.data.lateTaskCount).toBe(3);
    }
  });

  it("C. an unauthorized caller never receives the real purchase amount anywhere in the payload", async () => {
    setUpDefaults(); // analytics.view only
    vi.mocked(listPurchases).mockResolvedValue([{ total_minor: 999999 }] as never);

    const result = await getOperationsAnalyticsData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(JSON.stringify(result.data)).not.toContain("999999");
      expect(result.data.totalPurchaseCostMinor).toBeNull();
    }
  });
});
