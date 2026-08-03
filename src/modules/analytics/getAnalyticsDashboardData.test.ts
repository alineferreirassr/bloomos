import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/core/analytics/engine", () => ({
  computeVisibleMetrics: vi.fn(),
}));

import { getAnalyticsDashboardData } from "@/modules/analytics/getAnalyticsDashboardData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { computeVisibleMetrics } from "@/core/analytics/engine";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view", "finance.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function snapshot(id: string, category: string, value = 1) {
  return { metric: { id, name: id, description: "", category, unit: "count", icon: "DollarSign" }, result: { value, previousValue: null, changePercent: null, trend: "flat" as const, series: [] } };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getAnalyticsDashboardData", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getAnalyticsDashboardData("30d");
    expect(result.success).toBe(false);
  });

  it("requires the analytics.view permission even for an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await getAnalyticsDashboardData("30d");
    expect(result.success).toBe(false);
  });

  it("groups computed snapshots by category, seeding every category with an empty array even if nothing was computed for it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(computeVisibleMetrics).mockResolvedValue([snapshot("revenue.total", "revenue")] as never);

    const result = await getAnalyticsDashboardData("30d");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.byCategory.revenue.map((s) => s.metric.id)).toEqual(["revenue.total"]);
      expect(result.data.byCategory.workflow).toEqual([]);
    }
  });

  it("curates the Overview as one headline metric per category that has any visible metrics", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(computeVisibleMetrics).mockResolvedValue([
      snapshot("revenue.total", "revenue"),
      snapshot("revenue.collected", "revenue"),
      snapshot("workflow.executions", "workflow"),
    ] as never);

    const result = await getAnalyticsDashboardData("30d");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overview.map((s) => s.metric.id)).toEqual(["revenue.total", "workflow.executions"]);
    }
  });

  it("passes the requested window key and the session's own workspace/permissions/role through to the Engine", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(computeVisibleMetrics).mockResolvedValue([]);

    await getAnalyticsDashboardData("year");
    expect(computeVisibleMetrics).toHaveBeenCalledWith({ workspaceId: "ws_1", permissions: activeSession.permissions, role: "owner", windowKey: "year" });
  });
});
