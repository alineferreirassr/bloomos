import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getPayments: vi.fn(),
  getExpenses: vi.fn(),
  getEvents: vi.fn(),
  getLeads: vi.fn(),
}));

import { listGoalsProgressAction, setGoalAction, deleteGoalAction } from "@/modules/analytics/goals/goalsActions";
import { resetGoalsStore } from "@/lib/data/core/analytics/goalsStore";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, getLeads } from "@/lib/data";

const ownerSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view", "workspace.manage", "finance.amounts.view", "finance.executive.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function setUpDefaults() {
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(ownerSession);
  vi.mocked(getPayments).mockResolvedValue([] as never);
  vi.mocked(getExpenses).mockResolvedValue([] as never);
  vi.mocked(getEvents).mockResolvedValue([] as never);
  vi.mocked(getLeads).mockResolvedValue([] as never);
  resetGoalsStore();
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("setGoalAction", () => {
  it("rejects a caller without workspace.manage", async () => {
    setUpDefaults();
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...ownerSession, permissions: ["analytics.view"] });
    const result = await setGoalAction({ metric: "monthlyRevenue", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: 500000 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative target or an end before the start", async () => {
    setUpDefaults();
    const negative = await setGoalAction({ metric: "monthlyRevenue", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: -1 });
    expect(negative.success).toBe(false);

    const badRange = await setGoalAction({ metric: "monthlyRevenue", periodStart: "2026-08-01T00:00:00.000Z", periodEnd: "2026-07-01T00:00:00.000Z", targetValue: 100 });
    expect(badRange.success).toBe(false);
  });

  it("creates a real Goal, then updates (never duplicates) it on a second call for the same metric/period", async () => {
    setUpDefaults();
    const first = await setGoalAction({ metric: "monthlyRevenue", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: 500000 });
    expect(first.success).toBe(true);

    const second = await setGoalAction({ metric: "monthlyRevenue", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: 750000 });
    expect(second.success).toBe(true);

    const listed = await listGoalsProgressAction();
    expect(listed.success).toBe(true);
    if (listed.success) {
      expect(listed.data).toHaveLength(1);
      expect(listed.data[0].goal.target_value).toBe(750000);
    }
  });
});

describe("listGoalsProgressAction", () => {
  it("computes progress from real payments within the goal's own period", async () => {
    setUpDefaults();
    await setGoalAction({ metric: "monthlyRevenue", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: 100000 });
    vi.mocked(getPayments).mockResolvedValue([
      { id: "p1", client_id: "c1", event_id: null, amount_minor: 60000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-07-15T00:00:00.000Z" },
      { id: "p2", client_id: "c1", event_id: null, amount_minor: 60000, currency: "usd", status: "succeeded", payment_type: "deposit", transaction_date: "2026-09-15T00:00:00.000Z" }, // outside the goal's period
    ] as never);

    const result = await listGoalsProgressAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].currentValue).toBe(60000);
      expect(result.data[0].progressPercent).toBe(60);
      expect(result.data[0].onTrack).toBe(false);
    }
  });

  it("reports null progress for customerSatisfaction — no data source exists yet", async () => {
    setUpDefaults();
    await setGoalAction({ metric: "customerSatisfaction", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: 90 });

    const result = await listGoalsProgressAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].currentValue).toBeNull();
      expect(result.data[0].progressPercent).toBeNull();
      expect(result.data[0].onTrack).toBeNull();
    }
  });
});

describe("deleteGoalAction", () => {
  it("removes a real Goal", async () => {
    setUpDefaults();
    const created = await setGoalAction({ metric: "events", periodStart: "2026-07-01T00:00:00.000Z", periodEnd: "2026-08-01T00:00:00.000Z", targetValue: 5 });
    expect(created.success).toBe(true);
    if (!created.success) return;

    const deleted = await deleteGoalAction(created.data.id);
    expect(deleted.success).toBe(true);
    if (deleted.success) expect(deleted.data.deleted).toBe(true);

    const listed = await listGoalsProgressAction();
    expect(listed.success).toBe(true);
    if (listed.success) expect(listed.data).toHaveLength(0);
  });
});
