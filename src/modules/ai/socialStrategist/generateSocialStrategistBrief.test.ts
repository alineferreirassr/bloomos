import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import type { AICompletion, AIProvider } from "@/core/ai/types";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

const { listSocialPosts, listLatestSocialPostMetricSnapshotsForWorkspace, listSocialAccountMetricSnapshots, listInstagramAccountIdentitiesForWorkspace, listIdeaItems, listInspirationItems, listScriptItems, listCarouselItems, getLeads } =
  vi.hoisted(() => ({
    listSocialPosts: vi.fn(),
    listLatestSocialPostMetricSnapshotsForWorkspace: vi.fn(),
    listSocialAccountMetricSnapshots: vi.fn(),
    listInstagramAccountIdentitiesForWorkspace: vi.fn(),
    listIdeaItems: vi.fn(),
    listInspirationItems: vi.fn(),
    listScriptItems: vi.fn(),
    listCarouselItems: vi.fn(),
    getLeads: vi.fn(),
  }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return { ...actual, listSocialPosts, listLatestSocialPostMetricSnapshotsForWorkspace, listSocialAccountMetricSnapshots, listInstagramAccountIdentitiesForWorkspace, listIdeaItems, listInspirationItems, listScriptItems, listCarouselItems, getLeads };
});

// `registerDefaultAIContextBuilders()` (called at module load) registers
// every context builder, not only `socialStrategistContext` — mocked for
// the same reason `generateCRMAssistantBrief.test.ts` mocks this exact set.
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

vi.mock("@/core/ai/registry", () => ({
  getAIProvider: vi.fn(),
  isAIConfigured: vi.fn(),
}));

import { generateSocialStrategistBrief } from "@/modules/ai/socialStrategist/generateSocialStrategistBrief";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getAIProvider, isAIConfigured } from "@/core/ai/registry";
import { SOCIAL_STRATEGIST_PROMPT_VERSION } from "@/modules/ai/socialStrategist/promptBuilder";
import { SOCIAL_STRATEGIST_SKILL_ID } from "@/modules/ai/socialStrategist/registerSocialStrategistSkill";

const activeSession: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "owner@amorebloom.com" },
  profile: { full_name: "Amoré Bloom Owner", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "owner", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["social.view"],
  workspaceDisplayName: "Amoré Bloom",
};

function mockAllEmpty(): void {
  listSocialPosts.mockResolvedValue([]);
  listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
  listIdeaItems.mockResolvedValue([]);
  listInspirationItems.mockResolvedValue([]);
  listScriptItems.mockResolvedValue([]);
  listCarouselItems.mockResolvedValue([]);
  getLeads.mockResolvedValue([]);
}

function validModelOutput(overrides: Record<string, unknown> = {}) {
  return {
    accountObservations: [],
    contentOpportunities: [],
    contentPillars: [],
    nextContentRecommendations: [],
    postingStrategyNotes: [],
    audienceObservations: [],
    referencedContent: [],
    conversionObservations: [],
    dataSufficiencyNotes: ["No Social posts exist yet."],
    confidence: 0,
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateSocialStrategistBrief", () => {
  it("returns a generic access error for a member without an active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(false);
    expect(listSocialPosts).not.toHaveBeenCalled();
  });

  it("returns a generic access error for a member lacking social.view", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, permissions: [] });
    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(false);
    expect(listSocialPosts).not.toHaveBeenCalled();
  });

  it("uses the deterministic mock provider and reports mock:true when no provider is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(true);
      expect(result.data.brief.isEmpty).toBe(true);
      expect(result.data.brief.dataGaps.length).toBeGreaterThan(0);
    }
  });

  it("uses the registered provider and reports mock:false when one is configured", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    const liveProvider: AIProvider = {
      name: "live-stub",
      complete: async (): Promise<AICompletion> => ({
        content: JSON.stringify(validModelOutput()),
        requiresApproval: true,
        model: "live-stub-1",
        finishReason: "stop",
      }),
    };
    vi.mocked(getAIProvider).mockReturnValue(liveProvider);

    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.mock).toBe(false);
      expect(result.data.provider).toBe("live-stub");
      expect(result.data.promptVersion).toBe(SOCIAL_STRATEGIST_PROMPT_VERSION);
    }
  });

  it("rejects malformed (non-JSON) provider output rather than partially trusting it", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "broken",
      complete: async () => ({ content: "not json", requiresApproval: true, model: "broken-1", finishReason: "stop" }),
    });

    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(false);
  });

  it("rejects a response that references a Post/Idea not present in this Workspace's current context", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "inventive",
      complete: async () => ({
        content: JSON.stringify(validModelOutput({ contentOpportunities: [{ label: "x", reason: "x", relatedPostId: "invented_post", relatedIdeaId: null }] })),
        requiresApproval: true,
        model: "inventive-1",
        finishReason: "stop",
      }),
    });

    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/referenced content that doesn't exist/i);
  });

  it("returns a safe error, never a raw exception, when the provider throws", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(true);
    vi.mocked(getAIProvider).mockReturnValue({
      name: "flaky",
      complete: async () => {
        throw new Error("connection reset by peer, secret_key=sk-abc123");
      },
    });

    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).not.toMatch(/secret_key|sk-abc123/);
  });

  it("propagates a safe error rather than throwing when context assembly itself fails", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    listSocialPosts.mockRejectedValue(new Error("relation social_posts does not exist"));
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    // A single failing category degrades gracefully into `unavailableCategories`
    // (SOCIAL-14B's own Promise.allSettled design) rather than failing the whole
    // request — this proves the wrapper never throws even under that failure.
    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.context.unavailableCategories).toContain("posts");
  });

  it("executes through executeSkill() with the registered social-strategist skill id", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(activeSession);
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    const result = await generateSocialStrategistBrief();
    expect(result.success).toBe(true);
    expect(SOCIAL_STRATEGIST_SKILL_ID).toBe("social-strategist");
  });

  it("threads the caller's own session workspaceId into the underlying data fetch", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ ...activeSession, workspace: { id: "ws_specific", name: "Amoré Bloom" } });
    mockAllEmpty();
    vi.mocked(isAIConfigured).mockReturnValue(false);
    vi.mocked(getAIProvider).mockReturnValue(undefined);

    await generateSocialStrategistBrief();
    expect(listSocialPosts).toHaveBeenCalledWith("ws_specific");
  });
});
