import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { browseAIMemory } from "@/modules/ai/memory/browseAIMemory";
import { BROWSE_AI_MEMORY_SKILL_ID } from "@/modules/ai/memory/registerBrowseAIMemorySkill";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getMemoryManager } from "@/core/ai/memory";
import { resetAIMemoryStore } from "@/lib/data/core/aiMemory/mockRepository";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["events.view", "events.update"],
  workspaceDisplayName: "Amoré Bloom",
};

afterEach(() => {
  vi.clearAllMocks();
  resetAIMemoryStore();
});

describe("browseAIMemory", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await browseAIMemory();
    expect(result.success).toBe(false);
  });

  it("returns this Workspace's own memories through executeSkill(), never a raw prompt/provider call", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getMemoryManager().createMemory("ws_1", {
      skillId: BROWSE_AI_MEMORY_SKILL_ID,
      title: "A remembered decision",
      summary: "Expedited this Contract because the Client requested a rush turnaround.",
      category: "operational_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 90,
      source: "human",
    });

    const result = await browseAIMemory();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memories).toHaveLength(1);
      expect(result.data.memories[0].title).toBe("A remembered decision");
    }
  });

  it("never surfaces another Workspace's own memory", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getMemoryManager().createMemory("ws_other", {
      skillId: null,
      title: "Someone else's Workspace memory",
      summary: "Should never appear here.",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });

    const result = await browseAIMemory();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memories).toHaveLength(0);
  });

  it("never surfaces another member's own user-visible memory", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getMemoryManager().createMemory("ws_1", {
      skillId: null,
      title: "Another member's private note",
      summary: "Should never appear for user_1.",
      category: "workspace_knowledge",
      importance: "medium",
      visibility: "user",
      userId: "user_other",
      confidence: 100,
      source: "human",
    });

    const result = await browseAIMemory();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memories).toHaveLength(0);
  });

  it("never surfaces a still-proposed memory awaiting human review", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getMemoryManager().proposeMemory("ws_1", {
      skillId: "proposal.generate",
      title: "An AI-suggested memory",
      summary: "Not yet approved by a human.",
      visibility: "workspace",
    });

    const result = await browseAIMemory();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memories).toHaveLength(0);
  });

  it("filters by category when requested", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    await getMemoryManager().createMemory("ws_1", {
      skillId: null,
      title: "Historical snapshot",
      summary: "[]",
      category: "historical_knowledge",
      importance: "low",
      visibility: "workspace",
      confidence: 100,
      source: "system",
    });
    await getMemoryManager().createMemory("ws_1", {
      skillId: null,
      title: "Reference fact",
      summary: "A stable fact worth citing.",
      category: "reference_knowledge",
      importance: "high",
      visibility: "workspace",
      confidence: 100,
      source: "human",
    });

    const result = await browseAIMemory({ category: "reference_knowledge" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memories).toHaveLength(1);
      expect(result.data.memories[0].title).toBe("Reference fact");
    }
  });
});
