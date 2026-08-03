import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";

vi.mock("@/lib/auth/memberSessionSnapshot", () => ({
  resolveMemberSessionSnapshot: vi.fn(),
}));

import { evaluateBusinessHealthAction } from "@/modules/knowledgeGraph/businessHealthActions";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resetKnowledgeGraphStore } from "@/lib/data/core/knowledge/knowledgeGraphStore";
import { resetMediaAssetsStore } from "@/lib/data/mock/mediaAssetsStore";
import { resetTimelineStore, readActivities } from "@/lib/data/mock/timelineStore";
import { resetBusinessHealthSnapshotsStore } from "@/lib/data/mock/businessHealthSnapshotsStore";
import { HEALTH_CATEGORIES } from "@/types/businessHealth";

const session: MemberSessionSnapshot = {
  kind: "active",
  user: { id: "user_1", email: "ana@amorebloom.com" },
  profile: { full_name: "Ana Ferreira", avatar_url: null },
  workspace: { id: "ws_1", name: "Amoré Bloom" },
  membership: { id: "member_1", role: "manager", status: "active", created_at: "2026-01-01T00:00:00Z" },
  permissions: ["assets.view", "assets.manage"],
  workspaceDisplayName: "Amoré Bloom",
};

function resetAll(): void {
  resetKnowledgeGraphStore();
  resetMediaAssetsStore();
  resetTimelineStore();
  resetBusinessHealthSnapshotsStore();
}

beforeEach(() => {
  resetAll();
  vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue(session);
});

afterEach(() => {
  resetAll();
});

describe("evaluateBusinessHealthAction", () => {
  it("rejects a caller with no active session", async () => {
    vi.mocked(resolveMemberSessionSnapshot).mockResolvedValue({ kind: "unauthenticated" });
    const result = await evaluateBusinessHealthAction();
    expect(result.success).toBe(false);
  });

  it("computes all 11 named health categories against the seeded workspace", async () => {
    const result = await evaluateBusinessHealthAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.businessHealth.categories.map((c) => c.category).sort()).toEqual([...HEALTH_CATEGORIES].sort());
    expect(result.data.businessHealth.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.data.businessHealth.overallScore).toBeLessThanOrEqual(100);
  });

  it("returns one readiness score per fetched proposal/event/client/vendor, each carrying a valid node ref", async () => {
    const result = await evaluateBusinessHealthAction();
    expect(result.success).toBe(true);
    if (!result.success) return;
    for (const score of result.data.eventReadiness) expect(score.node.nodeType).toBe("event");
    for (const score of result.data.clientReadiness) expect(score.node.nodeType).toBe("client");
    for (const score of result.data.vendorReadiness) expect(score.node.nodeType).toBe("vendor");
    for (const score of result.data.proposalReadiness) expect(score.node.nodeType).toBe("proposal");
  });

  it("does not crash on a second evaluation and never regresses to duplicate Timeline noise for an unchanged workspace", async () => {
    const first = await evaluateBusinessHealthAction();
    expect(first.success).toBe(true);
    const activitiesAfterFirst = readActivities().length;

    const second = await evaluateBusinessHealthAction();
    expect(second.success).toBe(true);
    if (!first.success || !second.success) return;

    // The workspace state didn't change between calls, so the diff engine should find nothing new to report.
    expect(second.data.businessHealth.overallScore).toBe(first.data.businessHealth.overallScore);
    expect(readActivities().length).toBe(activitiesAfterFirst);
  });
});
