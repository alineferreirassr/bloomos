import { afterEach, describe, expect, it } from "vitest";
import { mockMediaKitRepository, resetMediaKitStore } from "@/lib/data/mediaKit/mockRepository";

describe("mockMediaKitRepository", () => {
  afterEach(() => {
    resetMediaKitStore();
  });

  // MEDIAKIT-02.1 — the founder correction this file exists to guard: a
  // plain read must never persist a row.
  it("getMediaKit returns null for a workspace with no Media Kit — never creates one", async () => {
    const result = await mockMediaKitRepository.getMediaKit("workspace_1");
    expect(result).toBeNull();
  });

  it("repeated getMediaKit calls stay null — read is idempotent, never side-effecting", async () => {
    await mockMediaKitRepository.getMediaKit("workspace_1");
    await mockMediaKitRepository.getMediaKit("workspace_1");
    const result = await mockMediaKitRepository.getMediaKit("workspace_1");
    expect(result).toBeNull();
  });

  it("createMediaKit creates a default row with schema defaults only — no fabricated brand copy, no seeded metrics", async () => {
    const result = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.workspace_id).toBe("workspace_1");
    expect(result.data.status).toBe("draft");
    expect(result.data.slug).toBe("amore-bloom");
    expect(result.data.headline).toBeNull();
    expect(result.data.positioning_statement).toBeNull();
    expect(result.data.brand_narrative).toBeNull();
    expect(result.data.social_links).toEqual([]);
    expect(result.data.current_published_snapshot_id).toBeNull();
    expect(result.data.published_at).toBeNull();
  });

  it("getMediaKit finds the row after createMediaKit", async () => {
    await mockMediaKitRepository.createMediaKit("workspace_1");
    const found = await mockMediaKitRepository.getMediaKit("workspace_1");
    expect(found).not.toBeNull();
    expect(found?.workspace_id).toBe("workspace_1");
  });

  it("repeated/double createMediaKit calls never create a duplicate — recovers to the same existing row", async () => {
    const first = await mockMediaKitRepository.createMediaKit("workspace_1");
    const second = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) return;
    expect(second.data.id).toBe(first.data.id);
  });

  it("scopes a fresh Media Kit per workspace", async () => {
    const workspaceA = await mockMediaKitRepository.createMediaKit("workspace_a");
    const workspaceB = await mockMediaKitRepository.createMediaKit("workspace_b");
    expect(workspaceA.success && workspaceB.success).toBe(true);
    if (!workspaceA.success || !workspaceB.success) return;
    expect(workspaceA.data.id).not.toBe(workspaceB.data.id);
  });

  it("reports every content section as not_started on a freshly created Media Kit", async () => {
    const created = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(created.success).toBe(true);
    if (!created.success) return;
    const status = await mockMediaKitRepository.getMediaKitContentStatus("workspace_1", created.data.id);
    for (const value of Object.values(status)) {
      expect(value).toBe("not_started");
    }
  });

  it("reports every analytics figure as a truthful zero, never fabricated, when no events exist", async () => {
    const created = await mockMediaKitRepository.createMediaKit("workspace_1");
    expect(created.success).toBe(true);
    if (!created.success) return;
    const analytics = await mockMediaKitRepository.getMediaKitAnalyticsSummary("workspace_1", created.data.id);
    expect(analytics).toEqual({ totalViews: 0, approxUniqueVisitors: 0, inquiries: 0, leadsGenerated: 0 });
  });
});
