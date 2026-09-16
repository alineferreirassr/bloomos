import { afterEach, describe, expect, it, vi } from "vitest";

// The fetch module imports `@/lib/supabase/server` (a real `import
// "server-only"`) at its own top level for the supabase-mode branch this
// file never exercises (mock mode is the default data mode, exercised
// below) — same precedent as every other server-only-adjacent test file in
// this codebase.
vi.mock("server-only", () => ({}));

const {
  listSocialPosts,
  listLatestSocialPostMetricSnapshotsForWorkspace,
  listSocialAccountMetricSnapshots,
  listInstagramAccountIdentitiesForWorkspace,
  listIdeaItems,
  listInspirationItems,
  listScriptItems,
  listCarouselItems,
  getLeads,
} = vi.hoisted(() => ({
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
  return {
    ...actual,
    listSocialPosts,
    listLatestSocialPostMetricSnapshotsForWorkspace,
    listSocialAccountMetricSnapshots,
    listInstagramAccountIdentitiesForWorkspace,
    listIdeaItems,
    listInspirationItems,
    listScriptItems,
    listCarouselItems,
    getLeads,
  };
});

import { fetchSocialStrategistMaterials } from "@/modules/ai/socialStrategist/fetchSocialStrategistContext.server";
import { makeLead } from "@/modules/leads/testUtils";

function post(overrides: Partial<Record<string, unknown>> = {}) {
  return { id: "post_1", workspace_id: "ws_1", status: "published", caption: "x", created_at: "2026-09-01T00:00:00.000Z", ...overrides };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchSocialStrategistMaterials — workspace isolation / authenticated resolution", () => {
  it("threads the given workspaceId into every underlying call, never a different or hardcoded one", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    await fetchSocialStrategistMaterials("ws_specific_123");

    expect(listSocialPosts).toHaveBeenCalledWith("ws_specific_123");
    expect(listInstagramAccountIdentitiesForWorkspace).toHaveBeenCalledWith("ws_specific_123");
    expect(listIdeaItems).toHaveBeenCalledWith("ws_specific_123", { archived: "active" });
    expect(listInspirationItems).toHaveBeenCalledWith("ws_specific_123", { archived: "active" });
    expect(listScriptItems).toHaveBeenCalledWith("ws_specific_123", { archived: "active" });
    expect(listCarouselItems).toHaveBeenCalledWith("ws_specific_123", { archived: "active" });
  });

  it("never passes a workspaceId sourced from anywhere but its own single explicit parameter — calling it twice with two different ids produces two independently-scoped calls", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    await fetchSocialStrategistMaterials("ws_a");
    await fetchSocialStrategistMaterials("ws_b");

    const calledWorkspaceIds = listSocialPosts.mock.calls.map((call) => call[0]);
    expect(calledWorkspaceIds).toEqual(["ws_a", "ws_b"]);
  });
});

describe("fetchSocialStrategistMaterials — empty datasets", () => {
  it("returns a fully empty, well-shaped materials object when every source is empty, no Instagram account", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(materials.posts).toEqual([]);
    expect(materials.postMetricsByPostId.size).toBe(0);
    expect(materials.instagramAccountId).toBeNull();
    expect(materials.accountMetrics).toEqual([]);
    expect(materials.unavailableCategories).toEqual([]);
    // No post ids exist, so the metrics lookup is never even called.
    expect(listLatestSocialPostMetricSnapshotsForWorkspace).not.toHaveBeenCalled();
    // No Instagram account identity exists, so account metrics are never even queried.
    expect(listSocialAccountMetricSnapshots).not.toHaveBeenCalled();
  });
});

describe("fetchSocialStrategistMaterials — partial datasets / resilience", () => {
  it("a rejected Ideas read does not blank out the rest of the materials, and is recorded as unavailable", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockRejectedValue(new Error("boom"));
    listInspirationItems.mockResolvedValue([{ id: "insp_1" }]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(materials.ideas).toEqual([]);
    expect(materials.unavailableCategories).toContain("ideas");
    expect(materials.inspiration).toEqual([{ id: "insp_1" }]);
    expect(materials.unavailableCategories).not.toContain("inspiration");
  });

  it("a rejected posts read marks posts unavailable and never attempts the dependent post-metrics read", async () => {
    listSocialPosts.mockRejectedValue(new Error("boom"));
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(materials.posts).toEqual([]);
    expect(materials.unavailableCategories).toContain("posts");
    expect(listLatestSocialPostMetricSnapshotsForWorkspace).not.toHaveBeenCalled();
  });

  it("a rejected Instagram Leads read is recorded as unavailable without affecting other categories", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockRejectedValue(new Error("boom"));

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(materials.instagramLeads).toEqual([]);
    expect(materials.unavailableCategories).toEqual(["instagramLeads"]);
  });
});

describe("fetchSocialStrategistMaterials — Instagram Lead filtering", () => {
  it("requests only source: 'Instagram' Leads, never all Leads", async () => {
    listSocialPosts.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([makeLead({ id: "lead_1", source: "Instagram" })]);

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(getLeads).toHaveBeenCalledWith({ source: "Instagram", includeArchived: false });
    expect(materials.instagramLeads).toHaveLength(1);
  });
});

describe("fetchSocialStrategistMaterials — account metrics only fetched when an Instagram account exists", () => {
  it("fetches account metrics when an identity is found, scoped to that account's own id", async () => {
    listSocialPosts.mockResolvedValue([post()]);
    listLatestSocialPostMetricSnapshotsForWorkspace.mockResolvedValue([]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([{ id: "identity_1", instagram_account_id: "ig_acct_42", instagram_username: "amorebloom" }]);
    listSocialAccountMetricSnapshots.mockResolvedValue([{ id: "snap_1", instagram_account_id: "ig_acct_42", metric_date: "2026-09-01", reach: 100, profile_views: 5 }]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(materials.instagramAccountId).toBe("ig_acct_42");
    expect(listSocialAccountMetricSnapshots).toHaveBeenCalledWith("ws_1", "ig_acct_42");
    expect(materials.accountMetrics).toHaveLength(1);
  });

  it("fetches latest post metrics keyed by the real fetched post ids", async () => {
    listSocialPosts.mockResolvedValue([post({ id: "post_a" }), post({ id: "post_b" })]);
    listLatestSocialPostMetricSnapshotsForWorkspace.mockResolvedValue([{ social_post_id: "post_a", total_interactions: 5 }]);
    listInstagramAccountIdentitiesForWorkspace.mockResolvedValue([]);
    listIdeaItems.mockResolvedValue([]);
    listInspirationItems.mockResolvedValue([]);
    listScriptItems.mockResolvedValue([]);
    listCarouselItems.mockResolvedValue([]);
    getLeads.mockResolvedValue([]);

    const materials = await fetchSocialStrategistMaterials("ws_1");

    expect(listLatestSocialPostMetricSnapshotsForWorkspace).toHaveBeenCalledWith("ws_1", ["post_a", "post_b"]);
    expect(materials.postMetricsByPostId.get("post_a")).toMatchObject({ total_interactions: 5 });
  });
});
