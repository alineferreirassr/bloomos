import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/lib/data", () => ({
  getLeads: vi.fn(),
}));

import { getSalesFunnelData } from "@/modules/analytics/funnel/getSalesFunnelData";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getLeads } from "@/lib/data";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["leads.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function lead(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "l1",
    workspace_id: "ws_1",
    first_name: "A",
    last_name: "B",
    email: "a@b.com",
    phone: null,
    instagram: null,
    source: "referral",
    event_type: null,
    event_date: null,
    location: null,
    budget_min: null,
    budget_max: null,
    message: null,
    status: "new",
    assigned_to: null,
    converted_client_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getSalesFunnelData", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getSalesFunnelData();
    expect(result.success).toBe(false);
  });

  it("buckets leads into their current working-stage snapshot", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(getLeads).mockResolvedValue([lead({ status: "new" }), lead({ status: "new" }), lead({ status: "qualified" })] as never);

    const result = await getSalesFunnelData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stages.find((s) => s.columnId === "lead")?.count).toBe(2);
      expect(result.data.stages.find((s) => s.columnId === "qualified")?.count).toBe(1);
    }
  });

  it("computes conversion rate over all leads and win rate over decided leads only", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(getLeads).mockResolvedValue([
      lead({ status: "converted", converted_client_id: "c1" }),
      lead({ status: "lost" }),
      lead({ status: "new" }),
      lead({ status: "new" }),
    ] as never);

    const result = await getSalesFunnelData();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conversionRatePercent).toBe(25); // 1 of 4
      expect(result.data.decidedWinRatePercent).toBe(50); // 1 of (1 won + 1 lost)
    }
  });

  it("reports null win rate when nothing has been decided yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(getLeads).mockResolvedValue([lead({ status: "new" })] as never);

    const result = await getSalesFunnelData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.decidedWinRatePercent).toBeNull();
  });

  it("computes average days to convert only from converted leads' created_at/updated_at gap", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(getLeads).mockResolvedValue([
      lead({ status: "converted", created_at: "2026-06-01T00:00:00.000Z", updated_at: "2026-06-11T00:00:00.000Z" }),
      lead({ status: "new" }),
    ] as never);

    const result = await getSalesFunnelData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.averageDaysToConvertLead).toBe(10);
  });

  it("identifies the most-stalled working stage by current count", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(getLeads).mockResolvedValue([lead({ status: "waiting_decision" }), lead({ status: "waiting_decision" }), lead({ status: "qualified" })] as never);

    const result = await getSalesFunnelData();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mostStalledStage?.columnId).toBe("waiting_decision");
  });
});
