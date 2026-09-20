import { afterEach, describe, expect, it } from "vitest";
import { mockMediaKitRepository, resetMediaKitStore } from "@/lib/data/mediaKit/mockRepository";

describe("mockMediaKitRepository", () => {
  afterEach(() => {
    resetMediaKitStore();
  });

  it("creates a default row with schema defaults only on first access — no fabricated brand copy, no seeded metrics", async () => {
    const mediaKit = await mockMediaKitRepository.getOrCreateMediaKit("workspace_1");

    expect(mediaKit.workspace_id).toBe("workspace_1");
    expect(mediaKit.status).toBe("draft");
    expect(mediaKit.slug).toBe("amore-bloom");
    expect(mediaKit.headline).toBeNull();
    expect(mediaKit.positioning_statement).toBeNull();
    expect(mediaKit.brand_narrative).toBeNull();
    expect(mediaKit.social_links).toEqual([]);
    expect(mediaKit.current_published_snapshot_id).toBeNull();
    expect(mediaKit.published_at).toBeNull();
  });

  it("is idempotent — a second call for the same workspace returns the same row, never a duplicate", async () => {
    const first = await mockMediaKitRepository.getOrCreateMediaKit("workspace_1");
    const second = await mockMediaKitRepository.getOrCreateMediaKit("workspace_1");
    expect(second.id).toBe(first.id);
  });

  it("scopes a fresh Media Kit per workspace", async () => {
    const workspaceA = await mockMediaKitRepository.getOrCreateMediaKit("workspace_a");
    const workspaceB = await mockMediaKitRepository.getOrCreateMediaKit("workspace_b");
    expect(workspaceA.id).not.toBe(workspaceB.id);
    expect(workspaceA.workspace_id).toBe("workspace_a");
    expect(workspaceB.workspace_id).toBe("workspace_b");
  });

  it("reports every content section as not_started on a freshly bootstrapped Media Kit", async () => {
    const mediaKit = await mockMediaKitRepository.getOrCreateMediaKit("workspace_1");
    const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", mediaKit.id);
    for (const value of Object.values(status)) {
      expect(value).toBe("not_started");
    }
  });

  it("reports every analytics figure as a truthful zero, never fabricated, when no events exist", async () => {
    const mediaKit = await mockMediaKitRepository.getOrCreateMediaKit("workspace_1");
    const analytics = await mockMediaKitRepository.getMediaKitAnalyticsSummary("workspace_1", mediaKit.id);
    expect(analytics).toEqual({ totalViews: 0, approxUniqueVisitors: 0, inquiries: 0, leadsGenerated: 0 });
  });
});
