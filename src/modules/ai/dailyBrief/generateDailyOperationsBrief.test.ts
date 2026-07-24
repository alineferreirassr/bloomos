import { afterEach, describe, expect, it, vi } from "vitest";
import { makeEvent } from "@/modules/events/testUtils";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

vi.mock("@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server", () => ({
  fetchDailyOperationsBriefRecords: vi.fn(),
}));

vi.mock("@/core/ai", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateDailyOperationsBrief } from "@/modules/ai/dailyBrief/generateDailyOperationsBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { fetchDailyOperationsBriefRecords } from "@/modules/ai/dailyBrief/fetchDailyOperationsBriefContext.server";
import { getAIProvider, isAIConfigured } from "@/core/ai";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view"],
  workspaceDisplayName: "Amoré Bloom",
};

const records = [{ event: makeEvent({ id: "event_1" }), client: null, checklist: [], schedule: [] }];

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateDailyOperationsBrief", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    expect(fetchDailyOperationsBriefRecords).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking events.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    expect(fetchDailyOperationsBriefRecords).not.toHaveBeenCalled();
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefRecords).mockResolvedValue(records);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.brief.overview.length).toBeGreaterThan(0);
      expect(result.data.brief.topPriorities.length).toBeGreaterThan(0);
    }
  });

  it("stamps versioning metadata", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefRecords).mockResolvedValue(records);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.promptVersion).toMatch(/^daily-operations-brief-v\d+$/);
      expect(result.data.contextVersion).toMatch(/^daily-operations-brief-context-v\d+$/);
    }
  });

  it("propagates a safe error rather than throwing when the context fetch itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefRecords).mockRejectedValue(new Error("relation events does not exist"));

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toMatch(/relation|does not exist/);
    }
  });

  it("rejects malformed provider output rather than partially trusting it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    vi.mocked(fetchDailyOperationsBriefRecords).mockResolvedValue(records);
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    const result = await generateDailyOperationsBrief();
    expect(result.success).toBe(false);
  });
});
