import { describe, expect, it } from "vitest";
import { snapshotFromAsset, buildOutgoingVersion, nextVersionNumber, fullVersionHistory, compareVersionMetadata, restoreVersionPlaceholder } from "@/core/digitalAssets/versionEngine";
import { buildTestAsset } from "@/core/digitalAssets/testFixtures";
import type { AssetVersion } from "@/types/digitalAssets";

describe("snapshotFromAsset", () => {
  it("freezes the file-descriptor fields", () => {
    const asset = buildTestAsset({ file_size: 2048, checksum: "xyz" });
    const snapshot = snapshotFromAsset(asset);
    expect(snapshot.file_size).toBe(2048);
    expect(snapshot.checksum).toBe("xyz");
  });
});

describe("buildOutgoingVersion", () => {
  it("captures the asset's current version number and snapshot", () => {
    const asset = buildTestAsset({ version: 3 });
    const outgoing = buildOutgoingVersion(asset, "ws_1");
    expect(outgoing.version).toBe(3);
    expect(outgoing.asset_id).toBe(asset.id);
    expect(outgoing.snapshot.file_size).toBe(asset.file_size);
  });
});

describe("nextVersionNumber", () => {
  it("is always the current version plus one", () => {
    expect(nextVersionNumber(buildTestAsset({ version: 1 }))).toBe(2);
    expect(nextVersionNumber(buildTestAsset({ version: 7 }))).toBe(8);
  });
});

describe("fullVersionHistory", () => {
  it("prepends the still-live current version to stored history, newest first", () => {
    const asset = buildTestAsset({ version: 3 });
    const stored: AssetVersion[] = [
      { id: "v1", workspace_id: "ws_1", asset_id: asset.id, version: 1, snapshot: snapshotFromAsset(asset), version_notes: null, created_by: null, captured_at: "2026-01-01T00:00:00.000Z" },
      { id: "v2", workspace_id: "ws_1", asset_id: asset.id, version: 2, snapshot: snapshotFromAsset(asset), version_notes: null, created_by: null, captured_at: "2026-01-02T00:00:00.000Z" },
    ];
    const history = fullVersionHistory(asset, stored);
    expect(history.map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it("ignores stored versions belonging to a different asset", () => {
    const asset = buildTestAsset({ id: "asset_1", version: 1 });
    const stored: AssetVersion[] = [{ id: "v1", workspace_id: "ws_1", asset_id: "asset_2", version: 1, snapshot: snapshotFromAsset(asset), version_notes: null, created_by: null, captured_at: "2026-01-01T00:00:00.000Z" }];
    expect(fullVersionHistory(asset, stored)).toHaveLength(1);
  });
});

describe("compareVersionMetadata", () => {
  it("flags exactly the fields that differ", () => {
    const a = snapshotFromAsset(buildTestAsset({ file_size: 100, checksum: "aaa" }));
    const b = snapshotFromAsset(buildTestAsset({ file_size: 200, checksum: "aaa" }));
    const diffs = compareVersionMetadata(a, b);
    const fileSizeDiff = diffs.find((d) => d.field === "file_size");
    const checksumDiff = diffs.find((d) => d.field === "checksum");
    expect(fileSizeDiff?.changed).toBe(true);
    expect(checksumDiff?.changed).toBe(false);
  });
});

describe("restoreVersionPlaceholder", () => {
  it("never claims to actually restore a version", () => {
    const asset = buildTestAsset();
    const version: AssetVersion = { id: "v1", workspace_id: "ws_1", asset_id: asset.id, version: 1, snapshot: snapshotFromAsset(asset), version_notes: null, created_by: null, captured_at: "2026-01-01T00:00:00.000Z" };
    const result = restoreVersionPlaceholder(version);
    expect(result.supported).toBe(false);
  });
});
