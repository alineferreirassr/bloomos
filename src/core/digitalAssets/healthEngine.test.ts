import { describe, expect, it } from "vitest";
import { evaluateAssetHealth, bandForScore, summarizePlatformHealth } from "@/core/digitalAssets/healthEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";

const NOW = new Date("2026-06-01T00:00:00.000Z");

describe("evaluateAssetHealth", () => {
  it("scores a perfectly healthy asset at 100, excellent", () => {
    const asset = buildTestAsset({ folder_id: "folder_1", tags: ["brand"], updated_at: "2026-05-01T00:00:00.000Z" });
    const health = evaluateAssetHealth(asset, { isUnused: false, metadataComplete: true, previewType: "image", visibility: "team", otherActiveChecksums: [], now: NOW });
    expect(health.score).toBe(100);
    expect(health.band).toBe("excellent");
    expect(health.issues).toHaveLength(0);
  });

  it("flags unused_asset, no_folder, and no_tags together", () => {
    const asset = buildTestAsset({ folder_id: null, tags: [], updated_at: "2026-05-01T00:00:00.000Z" });
    const health = evaluateAssetHealth(asset, { isUnused: true, metadataComplete: true, previewType: "image", visibility: "team", otherActiveChecksums: [], now: NOW });
    const types = health.issues.map((i) => i.type);
    expect(types).toContain("unused_asset");
    expect(types).toContain("no_folder");
    expect(types).toContain("no_tags");
    expect(health.score).toBeLessThan(100);
  });

  it("flags old_version once the asset hasn't been touched in over a year", () => {
    const asset = buildTestAsset({ folder_id: "f1", tags: ["x"], updated_at: "2024-01-01T00:00:00.000Z" });
    const health = evaluateAssetHealth(asset, { isUnused: false, metadataComplete: true, previewType: "image", visibility: "team", otherActiveChecksums: [], now: NOW });
    expect(health.issues.map((i) => i.type)).toContain("old_version");
  });

  it("flags no_preview for unknown preview types", () => {
    const asset = buildTestAsset({ folder_id: "f1", tags: ["x"], updated_at: "2026-05-01T00:00:00.000Z" });
    const health = evaluateAssetHealth(asset, { isUnused: false, metadataComplete: true, previewType: "unknown", visibility: "team", otherActiveChecksums: [], now: NOW });
    expect(health.issues.map((i) => i.type)).toContain("no_preview");
  });

  it("flags permission_problem when a client-owned asset isn't client-visible", () => {
    const asset = buildTestAsset({ owner_type: "client", folder_id: "f1", tags: ["x"], updated_at: "2026-05-01T00:00:00.000Z" });
    const health = evaluateAssetHealth(asset, { isUnused: false, metadataComplete: true, previewType: "image", visibility: "internal_only", otherActiveChecksums: [], now: NOW });
    expect(health.issues.map((i) => i.type)).toContain("permission_problem");
  });

  it("flags duplicate_placeholder when another active asset shares the same checksum", () => {
    const asset = buildTestAsset({ checksum: "same", folder_id: "f1", tags: ["x"], updated_at: "2026-05-01T00:00:00.000Z" });
    const health = evaluateAssetHealth(asset, { isUnused: false, metadataComplete: true, previewType: "image", visibility: "team", otherActiveChecksums: ["same"], now: NOW });
    expect(health.issues.map((i) => i.type)).toContain("duplicate_placeholder");
  });
});

describe("bandForScore", () => {
  it("buckets scores into the 4 named bands", () => {
    expect(bandForScore(100)).toBe("excellent");
    expect(bandForScore(75)).toBe("good");
    expect(bandForScore(50)).toBe("attention");
    expect(bandForScore(10)).toBe("critical");
  });
});

describe("summarizePlatformHealth", () => {
  it("defaults to a perfect score for a workspace with no assets", () => {
    const summary = summarizePlatformHealth("ws_1", [], NOW);
    expect(summary.averageScore).toBe(100);
    expect(summary.assetsEvaluated).toBe(0);
  });

  it("averages scores and tallies the issue breakdown", () => {
    const healthy = evaluateAssetHealth(buildTestAsset({ id: "a1", folder_id: "f1", tags: ["x"], updated_at: "2026-05-01T00:00:00.000Z" }), { isUnused: false, metadataComplete: true, previewType: "image", visibility: "team", otherActiveChecksums: [], now: NOW });
    const unhealthy = evaluateAssetHealth(buildTestAsset({ id: "a2", folder_id: null, tags: [], updated_at: "2026-05-01T00:00:00.000Z" }), { isUnused: true, metadataComplete: true, previewType: "image", visibility: "team", otherActiveChecksums: [], now: NOW });
    const summary = summarizePlatformHealth("ws_1", [healthy, unhealthy], NOW);
    expect(summary.assetsEvaluated).toBe(2);
    expect(summary.assetsWithIssues).toBe(1);
    expect(summary.issueBreakdown.no_folder).toBe(1);
  });
});
