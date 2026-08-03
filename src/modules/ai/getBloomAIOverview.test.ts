import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { CreateProposalDraftInput } from "@/types/proposal";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { getBloomAIOverview } from "@/modules/ai/getBloomAIOverview";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { mockProposalsRepository, resetProposalsStore } from "@/lib/data/proposals/mockRepository";
import { mockDailyBriefExecutionsRepository, resetDailyBriefExecutionsStore } from "@/lib/data/dailyBrief/mockRepository";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";
import { getMemoryManager } from "@/core/ai/memory";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update", "clients.view", "finance.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function makeInput(overrides: Partial<CreateProposalDraftInput> = {}): CreateProposalDraftInput {
  return {
    event_id: "event_1",
    client_id: "client_1",
    parent_proposal_id: null,
    executive_summary: "A summary.",
    event_overview: "An overview.",
    services_included: [],
    timeline_summary: "No schedule yet.",
    pricing_summary: { subtotal_minor: 0, currency: "USD" },
    payment_terms: [],
    recommendations: [],
    optional_add_ons: [],
    questions_for_client: [],
    ai_confidence: 80,
    missing_information: [],
    provider: "mock",
    model: "bloomos-mock-proposal-v1",
    prompt_version: "proposal-generator-v1",
    mock: true,
    generation_latency_ms: 10,
    generated_at: "2026-07-25T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  resetProposalsStore();
  resetDailyBriefExecutionsStore();
  resetAIMemoryStore();
});
afterEach(() => vi.clearAllMocks());

describe("getBloomAIOverview", () => {
  it("returns a generic access error without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await getBloomAIOverview();
    expect(result.success).toBe(false);
  });

  it("lists all six real Skills as active, discovered from the Skill Registry", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      const activeIds = result.data.skills.filter((s) => s.status === "active").map((s) => s.id);
      expect(activeIds).toEqual(
        expect.arrayContaining([
          "proposal.generate",
          "event-operations-brief",
          "daily-operations-brief",
          "browse-ai-memory",
          "crm-assistant",
          "finance-assistant",
        ]),
      );
    }
  });

  it("lists the one remaining placeholder Skill as coming soon", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      const comingSoonIds = result.data.skills.filter((s) => s.status === "coming_soon").map((s) => s.id);
      expect(comingSoonIds).toEqual(["document-assistant"]);
      expect(comingSoonIds).not.toContain("crm-assistant");
      expect(comingSoonIds).not.toContain("finance-assistant");
      expect(comingSoonIds).not.toContain("daily-brief");
    }
  });

  it("computes installed/active/coming-soon counts from the Skill Registry, not a hardcoded number", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.installedSkillsCount).toBeGreaterThanOrEqual(7);
      expect(result.data.activeSkillsCount).toBe(6);
      expect(result.data.comingSoonSkillsCount).toBe(1);
      expect(result.data.skills).toHaveLength(result.data.activeSkillsCount + result.data.comingSoonSkillsCount);
    }
  });

  it("reports the provider as unconfigured when no real AI provider is registered", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.providerConfigured).toBe(false);
  });

  it("computes usage stats from this Workspace's own recent proposals only", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const created = await mockProposalsRepository.createProposalDraft("ws_1", makeInput());
    if (!created.success) throw new Error("setup failed");
    await mockProposalsRepository.acceptProposal(created.data.id, "user_1");
    await mockProposalsRepository.createProposalDraft("ws_other", makeInput({ event_id: "event_2" }));

    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats).toEqual({ totalGenerated: 1, accepted: 1, rejected: 0, awaitingReview: 0 });
      expect(result.data.recentProposals).toHaveLength(1);
    }
  });

  it("returns zeroed stats and an empty activity list for a Workspace with no proposals yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stats).toEqual({ totalGenerated: 0, accepted: 0, rejected: 0, awaitingReview: 0 });
      expect(result.data.recentProposals).toEqual([]);
    }
  });

  it("surfaces this Workspace's own recent Daily Brief execution history", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await mockDailyBriefExecutionsRepository.recordExecution("ws_1", {
      status: "success",
      provider: "mock",
      model: "bloomos-daily-mock-v2",
      promptVersion: "daily-operations-brief-v2",
      mock: true,
      latencyMs: 42,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });
    await mockDailyBriefExecutionsRepository.recordExecution("ws_other", {
      status: "success",
      provider: "mock",
      model: null,
      promptVersion: "daily-operations-brief-v2",
      mock: true,
      latencyMs: 10,
      generatedAt: "2026-07-25T00:00:00.000Z",
    });

    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recentDailyBriefExecutions).toHaveLength(1);
      expect(result.data.recentDailyBriefExecutions[0].workspace_id).toBe("ws_1");
    }
  });

  it("returns a zeroed Memory summary and empty Recent Memories for a Workspace with no memory yet", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memorySummary.totalCount).toBe(0);
      expect(result.data.recentMemories).toEqual([]);
    }
  });

  it("surfaces this Workspace's own approved memories, workspace-visible plus this member's own user-visible ones — never another member's", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    const manager = getMemoryManager();
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "Workspace-wide note",
      summary: "Everyone can see this.",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "My own note",
      summary: "Only I can see this.",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "user",
      userId: "user_1",
      confidence: 100,
      source: "human",
    });
    await manager.createMemory("ws_1", {
      skillId: null,
      title: "Someone else's note",
      summary: "Another member's own memory.",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "user",
      userId: "user_other",
      confidence: 100,
      source: "human",
    });

    const result = await getBloomAIOverview();
    expect(result.success).toBe(true);
    if (result.success) {
      const titles = result.data.recentMemories.map((memory) => memory.title);
      expect(titles).toEqual(expect.arrayContaining(["Workspace-wide note", "My own note"]));
      expect(titles).not.toContain("Someone else's note");
      expect(result.data.memorySummary.totalCount).toBe(3);
      expect(result.data.memorySummary.approvedCount).toBe(3);
    }
  });
});
