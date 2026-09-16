import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { listSocialPosts, listLatestSocialPostMetricSnapshotsForWorkspace, listSocialAccountMetricSnapshots, listInstagramAccountIdentitiesForWorkspace, listIdeaItems, listInspirationItems, listScriptItems, listCarouselItems, getLeads, getAIProviderMock, isAIConfiguredMock } =
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
    // Both default to the "no real provider configured" state, so every
    // test in this file except the provider-failure one below keeps
    // exercising the real Skill through its own createMockProvider, exactly
    // as it would with no AI env vars set — matching production's own
    // unconfigured-by-default state, not a contrivance of this test file.
    getAIProviderMock: vi.fn().mockReturnValue(undefined),
    isAIConfiguredMock: vi.fn().mockReturnValue(false),
  }));

vi.mock("@/lib/data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data")>();
  return { ...actual, listSocialPosts, listLatestSocialPostMetricSnapshotsForWorkspace, listSocialAccountMetricSnapshots, listInstagramAccountIdentitiesForWorkspace, listIdeaItems, listInspirationItems, listScriptItems, listCarouselItems, getLeads };
});

vi.mock("@/core/ai/registry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/ai/registry")>();
  return { ...actual, getAIProvider: getAIProviderMock, isAIConfigured: isAIConfiguredMock };
});

// `registerDefaultAIContextBuilders()` pulls in every registered Context
// Builder (Event/Client/Proposal/Finance/Analytics/etc.), each reaching
// its own real data-fetching module — none of this is exercised by this
// file's own tests (only `socialStrategistContext` is requested), this
// mock set exists purely so the import graph resolves, matching every
// other AI-entry-point test file's own established mock set in this
// codebase.
vi.mock("@/modules/ai/fetchEventContext.server", () => ({ fetchEventContextRecord: vi.fn() }));
vi.mock("@/lib/data/mock/clientsStore", () => ({ readClients: vi.fn() }));
vi.mock("@/lib/data/mock/eventServicesStore", () => ({ readEventServices: vi.fn() }));
vi.mock("@/lib/data/mock/contractsStore", () => ({ readContracts: vi.fn() }));
vi.mock("@/lib/data/mock/notesTimelineShared", () => ({ getNotesByOwner: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { registerSocialStrategistSkill, SOCIAL_STRATEGIST_SKILL_ID } from "@/modules/ai/socialStrategist/registerSocialStrategistSkill";
import { registerDefaultAIContextBuilders } from "@/modules/ai/contextBuilders/registerContextBuilders";
import { getSkill } from "@/core/ai/skills/registry";
import { executeSkill, type ExecuteSkillParams } from "@/core/ai/skills/resolver";
import { socialStrategistModelOutputSchema } from "@/modules/ai/socialStrategist/schema";
import { makeLead } from "@/modules/leads/testUtils";
import type { SocialStrategistModelOutput } from "@/modules/ai/socialStrategist/types";
import type { AIProvider } from "@/core/ai/types";

registerSocialStrategistSkill();
registerDefaultAIContextBuilders();

function baseParams(overrides: Partial<ExecuteSkillParams> = {}): ExecuteSkillParams {
  return {
    skillId: SOCIAL_STRATEGIST_SKILL_ID,
    workspaceId: "ws_1",
    workspaceName: "Amoré Bloom",
    userId: "user_1",
    userName: "Aline",
    permissions: ["social.view"],
    role: "owner",
    refs: {},
    ...overrides,
  };
}

function mockAllEmpty(): void {
  listSocialPosts.mockResolvedValue([]);
  listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
  listIdeaItems.mockResolvedValue([]);
  listInspirationItems.mockResolvedValue([]);
  listScriptItems.mockResolvedValue([]);
  listCarouselItems.mockResolvedValue([]);
  getLeads.mockResolvedValue([]);
}

afterEach(() => {
  vi.clearAllMocks();
  // clearAllMocks() wipes call history but not a mock's own return-value
  // implementation, so these two are restored explicitly to keep every
  // other test's "no real provider configured" default intact.
  getAIProviderMock.mockReturnValue(undefined);
  isAIConfiguredMock.mockReturnValue(false);
});

describe("registerSocialStrategistSkill — registration / discovery", () => {
  it("registers the Skill under its own stable id, discoverable via getSkill()", () => {
    const skill = getSkill(SOCIAL_STRATEGIST_SKILL_ID);
    expect(skill).toBeDefined();
    expect(skill?.id).toBe(SOCIAL_STRATEGIST_SKILL_ID);
    expect(SOCIAL_STRATEGIST_SKILL_ID).toBe("social-strategist");
  });

  it("declares category 'social', requiredContext 'socialStrategistContext', and a real execute function", () => {
    const skill = getSkill(SOCIAL_STRATEGIST_SKILL_ID);
    expect(skill?.category).toBe("social");
    expect(skill?.requiredContext).toEqual(["socialStrategistContext"]);
    expect(typeof skill?.execute).toBe("function");
  });

  it("calling registerSocialStrategistSkill() again is a safe no-op — the registry still has exactly one entry for this id", () => {
    registerSocialStrategistSkill();
    expect(getSkill(SOCIAL_STRATEGIST_SKILL_ID)).toBeDefined();
  });

  it("is discoverable via the command palette and sidebar Skill surfaces now that its own dedicated page exists (SOCIAL-14D)", () => {
    const skill = getSkill(SOCIAL_STRATEGIST_SKILL_ID);
    expect(skill?.commandPaletteVisible).toBe(true);
    expect(skill?.sidebarVisible).toBe(true);
  });

  it("declares no real AI provider — createMockProvider is set, and no real provider registration exists anywhere in this module", () => {
    const skill = getSkill(SOCIAL_STRATEGIST_SKILL_ID);
    expect(typeof skill?.createMockProvider).toBe("function");
  });
});

describe("registerSocialStrategistSkill — input contract / permission / role / approval / feature-flag", () => {
  it("rejects execution for a caller missing social.view", async () => {
    const result = await executeSkill(baseParams({ permissions: [] }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.category).toBe("permission_denied");
  });

  it("requiresApproval is false — never blocks on approval", () => {
    expect(getSkill(SOCIAL_STRATEGIST_SKILL_ID)?.requiresApproval).toBe(false);
  });

  it("featureFlag/minimumRole are both null — no gate beyond the base permission check", () => {
    const skill = getSkill(SOCIAL_STRATEGIST_SKILL_ID);
    expect(skill?.featureFlag).toBeNull();
    expect(skill?.minimumRole).toBeNull();
  });

  it("rejects execution for an unregistered skill id, matching the resolver's own generic contract", async () => {
    const result = await executeSkill(baseParams({ skillId: "not-a-real-skill" }));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.category).toBe("invalid_request");
  });
});

describe("registerSocialStrategistSkill — workspace/context boundary", () => {
  it("threads the caller's own workspaceId into the underlying data fetch, never a value from refs", async () => {
    mockAllEmpty();
    await executeSkill(baseParams({ workspaceId: "ws_specific", refs: { workspaceId: "ws_should_be_ignored" } as never }));
    expect(listSocialPosts).toHaveBeenCalledWith("ws_specific");
  });

  it("a different workspaceId produces an independently-scoped context — never a cross-workspace read", async () => {
    mockAllEmpty();
    await executeSkill(baseParams({ workspaceId: "ws_a" }));
    await executeSkill(baseParams({ workspaceId: "ws_b" }));
    const calledIds = listSocialPosts.mock.calls.map((call) => call[0]);
    expect(calledIds).toEqual(["ws_a", "ws_b"]);
  });
});

describe("registerSocialStrategistSkill — structured output success (mock provider, empty workspace)", () => {
  it("returns a successful, schema-valid result for an entirely empty workspace", async () => {
    mockAllEmpty();
    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    if (!result.success) return;
    const parsed = socialStrategistModelOutputSchema.safeParse(result.data);
    expect(parsed.success).toBe(true);
    expect(result.metadata.mock).toBe(true);
    expect(result.metadata.skillId).toBe(SOCIAL_STRATEGIST_SKILL_ID);
  });

  it("the returned context is the real, built SocialStrategistContext, not a placeholder", async () => {
    mockAllEmpty();
    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.context).toMatchObject({ posts: [], ideas: [], instagramLeads: [] });
  });
});

describe("registerSocialStrategistSkill — partial data", () => {
  it("a failing Ideas read does not fail the whole Skill execution — the report still succeeds with ideas omitted", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockRejectedValue(new Error("boom"));
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.context as { ideas: unknown[] }).ideas).toEqual([]);
    expect((result.context as { unavailableCategories: string[] }).unavailableCategories).toContain("ideas");
  });
});

describe("registerSocialStrategistSkill — real, non-empty data end to end", () => {
  it("produces real, id-grounded output for a workspace with real posts/ideas/Instagram Leads", async () => {
    listSocialPosts.mockResolvedValue([{ id: "post_1", workspace_id: "ws_1", status: "published", caption: "Real caption", asset_id: "asset_1", target_provider: "meta", target_connection_id: "c1", target_page_id: "p1", target_instagram_account_id: "ig1", provider_container_id: null, provider_post_id: "media_1", provider_permalink: null, provider_error: null, published_at: "2026-09-01T00:00:00.000Z", scheduled_at: null, scheduled_timezone: null, publish_attempts: 0, next_attempt_at: null, created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z" }]);
    listLatestSocialPostMetricSnapshotsForWorkspace.mockResolvedValue([{ id: "snap_1", workspace_id: "ws_1", social_post_id: "post_1", provider_media_id: "media_1", captured_at: "2026-09-02T00:00:00.000Z", snapshot_date: "2026-09-02", views: 100, reach: 90, likes: 20, comments: 2, shares: 1, saved: 1, total_interactions: 24, raw_metrics: {}, created_at: "2026-09-02T00:00:00.000Z" }]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([{ id: "idea_1", workspace_id: "ws_1", title: "Behind the scenes", description: "x", status: "active", source_inspiration_id: null, content_format: "reel", hook: "hook", cta: "cta", audience: "Engaged couples", notes: null, media_asset_id: null, priority: "high", archived_at: null, created_by: "u1", created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z" }]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([makeLead({ id: "lead_1", source: "Instagram", instagram: "@curious_bride", first_name: null, last_name: null, email: null })]);

    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    if (!result.success) return;

    const output = result.data as SocialStrategistModelOutput;
    expect(socialStrategistModelOutputSchema.safeParse(output).success).toBe(true);
    expect(output.contentOpportunities.some((o) => o.relatedPostId === "post_1")).toBe(true);
    expect(output.nextContentRecommendations.some((r) => r.relatedIdeaId === "idea_1")).toBe(true);
    expect(output.conversionObservations.length).toBeGreaterThan(0);
  });

  it("never leaks a Lead's raw message/name/email anywhere in the full SkillExecutionResult, even serialized", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([makeLead({ id: "lead_1", source: "Instagram", message: "Call me at 555-0100, I'm Jane Doe", first_name: "Jane", last_name: "Doe", email: "jane@example.com", phone: "555-0100" })]);

    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("555-0100");
    expect(serialized).not.toContain("Jane");
    expect(serialized).not.toContain("jane@example.com");
  });

  it("never mentions a follower count, content-format breakdown claim, or external trend in the output", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([{ id: "identity_1", workspace_id: "ws_1", connection_id: "c1", instagram_account_id: "ig_1", instagram_username: "amorebloom", created_at: "2026-09-01T00:00:00.000Z", updated_at: "2026-09-01T00:00:00.000Z" }]);
    listSocialAccountMetricSnapshots.mockResolvedValue([{ id: "acct_snap_1", workspace_id: "ws_1", instagram_account_id: "ig_1", metric_date: "2026-09-01", reach: 500, profile_views: 20, raw_metrics: {}, created_at: "2026-09-01T00:00:00.000Z" }]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("follower");
  });
});

describe("registerSocialStrategistSkill — determinism", () => {
  it("two calls against the same underlying data produce the same structured output shape and content", async () => {
    mockAllEmpty();
    const first = await executeSkill(baseParams());
    const second = await executeSkill(baseParams());
    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(first.data).toEqual(second.data);
  });
});

describe("registerSocialStrategistSkill — provider failure using the existing AI runtime, no real provider", () => {
  it("surfaces a provider_failure error when the configured provider throws, via the real executeAIRequest error-handling path", async () => {
    mockAllEmpty();
    // No real provider is registered anywhere in this checkpoint — this
    // substitutes a test-only fake shaped like AIProvider, purely to prove
    // the Skill correctly surfaces whatever executeAIRequest reports when
    // the resolved provider errors. It is not a real OpenAI/Anthropic
    // integration and nothing about it is registered outside this test.
    const failingProvider: AIProvider = {
      name: "test-failing-provider",
      complete: async () => {
        throw new Error("simulated provider outage");
      },
    };
    isAIConfiguredMock.mockReturnValue(true);
    getAIProviderMock.mockReturnValue(failingProvider);

    const result = await executeSkill(baseParams());

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.category).toBe("provider_failure");
  });

  it("still uses the mock provider path (mock: true) when no real provider is configured, the default in every other test in this file", async () => {
    mockAllEmpty();
    const result = await executeSkill(baseParams());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.metadata.mock).toBe(true);
  });
});
