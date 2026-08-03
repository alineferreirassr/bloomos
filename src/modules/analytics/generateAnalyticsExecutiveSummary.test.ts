import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));
vi.mock("@/core/ai/skills/resolver", () => ({
  executeSkill: vi.fn(),
}));
vi.mock("@/modules/analytics/aiSummary/registerAnalyticsExecutiveSummarySkill", () => ({
  registerAnalyticsExecutiveSummarySkill: vi.fn(),
  ANALYTICS_EXECUTIVE_SUMMARY_SKILL_ID: "analytics-executive-summary",
}));
vi.mock("@/modules/ai/contextBuilders/registerContextBuilders", () => ({
  registerDefaultAIContextBuilders: vi.fn(),
}));

import { generateAnalyticsExecutiveSummary } from "@/modules/analytics/generateAnalyticsExecutiveSummary";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { executeSkill } from "@/core/ai/skills/resolver";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["analytics.view"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateAnalyticsExecutiveSummary", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateAnalyticsExecutiveSummary("30d");
    expect(result.success).toBe(false);
    expect(executeSkill).not.toHaveBeenCalled();
  });

  it("requires the analytics.view permission", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await generateAnalyticsExecutiveSummary("30d");
    expect(result.success).toBe(false);
    expect(executeSkill).not.toHaveBeenCalled();
  });

  it("passes the window key, and the session's own permissions/role comma-joined, through refs", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(executeSkill).mockResolvedValue({ success: true, data: { executiveSummary: "ok", operationalRisks: [], performanceHighlights: [], recommendations: [] }, context: {}, metadata: {} as never });

    await generateAnalyticsExecutiveSummary("7d");
    expect(executeSkill).toHaveBeenCalledWith(
      expect.objectContaining({ skillId: "analytics-executive-summary", workspaceId: "ws_1", refs: { windowKey: "7d", permissions: "analytics.view", role: "owner" } }),
    );
  });

  it("maps a Skill failure to a generic, user-facing error message", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(executeSkill).mockResolvedValue({ success: false, error: { category: "provider_failure", message: "boom" } });

    const result = await generateAnalyticsExecutiveSummary("30d");
    expect(result.success).toBe(false);
  });

  it("returns the Skill's own narrative output on success", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const data = { executiveSummary: "Momentum is positive.", operationalRisks: [], performanceHighlights: ["Revenue up 10%"], recommendations: [] };
    vi.mocked(executeSkill).mockResolvedValue({ success: true, data, context: {}, metadata: {} as never });

    const result = await generateAnalyticsExecutiveSummary("30d");
    expect(result).toEqual({ success: true, data });
  });
});
