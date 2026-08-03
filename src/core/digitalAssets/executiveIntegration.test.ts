import { describe, expect, it } from "vitest";
import { digitalAssetsRecommendationsForExecutiveDecisions } from "@/core/digitalAssets/executiveIntegration";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";
import type { AssetHealth, PlatformHealthSummary } from "@/types/digitalAssets";

function platformSummary(overrides: Partial<PlatformHealthSummary> = {}): PlatformHealthSummary {
  return {
    workspaceId: "ws_1",
    averageScore: 100,
    band: "excellent",
    assetsEvaluated: 0,
    assetsWithIssues: 0,
    issueBreakdown: { unused_asset: 0, missing_metadata: 0, no_folder: 0, no_tags: 0, old_version: 0, no_preview: 0, permission_problem: 0, duplicate_placeholder: 0 },
    evaluatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("digitalAssetsRecommendationsForExecutiveDecisions", () => {
  it("returns no recommendations for a fully healthy workspace", () => {
    const recs = digitalAssetsRecommendationsForExecutiveDecisions([], [], platformSummary());
    expect(recs).toHaveLength(0);
  });

  it("translates an unused_asset issue into a recommendation naming the file", () => {
    const asset = buildTestAsset({ id: "a1", original_filename: "old-flyer.pdf" });
    const health: AssetHealth = { assetId: "a1", score: 85, band: "good", issues: [{ type: "unused_asset", detail: "unused" }], evaluatedAt: "2026-06-01T00:00:00.000Z" };
    const recs = digitalAssetsRecommendationsForExecutiveDecisions([health], [asset], platformSummary());
    expect(recs).toHaveLength(1);
    expect(recs[0].ruleId).toBe("dam_unused_asset");
    expect(recs[0].message).toContain("old-flyer.pdf");
  });

  it("flags large storage growth once total active storage exceeds 5 GB", () => {
    const bigAsset = buildTestAsset({ id: "a1", file_size: 6 * 1024 * 1024 * 1024 });
    const recs = digitalAssetsRecommendationsForExecutiveDecisions([], [bigAsset], platformSummary());
    expect(recs.some((r) => r.ruleId === "dam_large_storage_growth")).toBe(true);
  });

  it("flags folders needing organization once 10+ assets have no_folder", () => {
    const recs = digitalAssetsRecommendationsForExecutiveDecisions([], [], platformSummary({ issueBreakdown: { unused_asset: 0, missing_metadata: 0, no_folder: 12, no_tags: 0, old_version: 0, no_preview: 0, permission_problem: 0, duplicate_placeholder: 0 } }));
    expect(recs.some((r) => r.ruleId === "dam_folders_needing_organization")).toBe(true);
  });

  it("skips a health result whose asset can't be resolved", () => {
    const health: AssetHealth = { assetId: "missing", score: 50, band: "attention", issues: [{ type: "unused_asset", detail: "unused" }], evaluatedAt: "2026-06-01T00:00:00.000Z" };
    const recs = digitalAssetsRecommendationsForExecutiveDecisions([health], [], platformSummary());
    expect(recs).toHaveLength(0);
  });
});
