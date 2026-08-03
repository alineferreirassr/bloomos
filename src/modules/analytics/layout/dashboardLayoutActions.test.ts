import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getDashboardLayoutAction, saveDashboardLayoutAction } from "@/modules/analytics/layout/dashboardLayoutActions";
import { resetDashboardLayoutStore } from "@/lib/data/core/analytics/dashboardLayoutStore";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { EXECUTIVE_DASHBOARD_WIDGET_IDS } from "@/modules/analytics/executive/executiveWidgets";

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
  resetDashboardLayoutStore();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardLayoutAction", () => {
  it("returns a generic access error without an active session", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getDashboardLayoutAction();
    expect(result.success).toBe(false);
  });

  it("returns a default layout (every widget visible, in registry order) when nothing has been saved yet", async () => {
    setUpDefaults();
    const result = await getDashboardLayoutAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.widgets.map((w) => w.widgetId)).toEqual([...EXECUTIVE_DASHBOARD_WIDGET_IDS]);
      expect(result.data.widgets.every((w) => !w.hidden && !w.pinned)).toBe(true);
    }
  });
});

describe("saveDashboardLayoutAction", () => {
  it("rejects an unknown widget id", async () => {
    setUpDefaults();
    const result = await saveDashboardLayoutAction([{ widgetId: "not-a-real-widget", pinned: false, hidden: false, order: 0 }]);
    expect(result.success).toBe(false);
  });

  it("persists pin/hide/order per member, and getDashboardLayoutAction reflects it back", async () => {
    setUpDefaults();
    const customized = EXECUTIVE_DASHBOARD_WIDGET_IDS.map((widgetId, order) => ({ widgetId, pinned: widgetId === "profit", hidden: widgetId === "averageDeposit", order: EXECUTIVE_DASHBOARD_WIDGET_IDS.length - order }));
    const saved = await saveDashboardLayoutAction(customized);
    expect(saved.success).toBe(true);

    const fetched = await getDashboardLayoutAction();
    expect(fetched.success).toBe(true);
    if (fetched.success) {
      expect(fetched.data.widgets.find((w) => w.widgetId === "profit")?.pinned).toBe(true);
      expect(fetched.data.widgets.find((w) => w.widgetId === "averageDeposit")?.hidden).toBe(true);
    }
  });

  it("scopes layouts per member — one member's saved layout never leaks into another's", async () => {
    setUpDefaults();
    await saveDashboardLayoutAction(EXECUTIVE_DASHBOARD_WIDGET_IDS.map((widgetId, order) => ({ widgetId, pinned: false, hidden: widgetId === "profit", order })));

    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, membership: { ...activeSession.membership, id: "member_2" } });
    const otherMemberLayout = await getDashboardLayoutAction();
    expect(otherMemberLayout.success).toBe(true);
    if (otherMemberLayout.success) expect(otherMemberLayout.data.widgets.find((w) => w.widgetId === "profit")?.hidden).toBe(false);
  });
});
